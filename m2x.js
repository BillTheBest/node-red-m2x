module.exports = function (RED) {
    var m2x = require('m2x');
    var log = require('log-driver').logger;
    var async = require('async');    
    var M2X_API_SERVER = "https://api-m2x.att.com/";
    // CF  - General Error code in case of error
    var ERROR_CODE = 500;
    var INPUT_ERROR_CODE = 400;


    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;
    function getParamNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if (result === null)
            result = [];
        return result;
    }
    function getAllMethods(object) {
        var methods = [];
        for (var member in object) {
            if (typeof (object[member]) === 'function') {
                methods.push(member);
            }
        }
        return methods;
    }
    
    function cleanForNextNode(msg) {
        // CF: Clear the clatter for the next node
        try {
            delete msg.topic;
            delete msg.topic_id;
            delete msg.sub_topic_id;
            delete msg.action;                
        } catch (e) {
           log.error("WARNING - cannot delete msg input field, probably working on STRICT mode")
        }
    }
    

    function M2XFeedNode(n) {
        var _this = this;
        RED.nodes.createNode(_this, n);
        _this.apiKey = n.apiKey;
        _this.node = n;
    }
    RED.nodes.registerType("m2x feed", M2XFeedNode);

    function M2XNode(_this, n) {
        _this.node = n;
        var API_VER = "v2";
        _this.feedNode = RED.nodes.getNode(_this.node.feed);
        //_this.apiVer = n.apiVer;
        if (!_this.feedNode)
        {
            _this.error("missing m2x feed configuration");
        }
        _this.on("input", function (msg) {
            // Override Configured API Key with the one on the request, 
            // The feed ID is allways used by the one in the request
            // and fail over to the configured one.
            var api_key;

            // FindM2X Key on coniguration/messge
            if (!msg || !msg.m2x_key || !msg.req.headers || (api_key = msg.m2x_key) === null) {
                if (typeof (_this.feedNode) === 'undefined') {
                    return _this.handle_msg_failure(msg, 409, "failure - missing M2X feed configuration and no mwx_key in msg");
                }
                log.info("Using configured X-M2X-KEY [" + _this.feedNode.apiKey + "]");
                _this.m2xClient = new m2x(_this.feedNode.apiKey, M2X_API_SERVER + API_VER);
            } else {
                _this.m2xClient = new m2x(api_key, M2X_API_SERVER + API_VER);
            }
            // Validate Msg Input
            validate_msg(msg, msg.topic, /distributions\b|devices\b|charts\b|keys\b/,
                    INPUT_ERROR_CODE, "msg.topic should be distributions ,devices, charts or keys");
            var topic = msg.topic;
            // Get all methods and validte against msg.action
            var methods = getAllMethods(_this.m2xClient[topic]);
            if (!msg.action || methods.indexOf(msg.action) === -1) {
                 log.error("methods doesn't exists");
                _this.handle_msg_failure(msg, INPUT_ERROR_CODE, "action for " + topic + " must be either " + methods);
            }
            //TODO : validate why devices.listTriggers  pass this parttrig
            // CF: Verification - from some reason the above doesn't allways works
            if (!(typeof (_this.m2xClient[topic][msg.action]) === 'function')) {
                this.handle_msg_failure(msg, INPUT_ERROR_CODE, 
                "Cannot find " + msg.action +" in " + topic + " validate agains m2x client node, API is applicable");
            }
            // Get list of parameters for that method
            var arguments = getParamNames(_this.m2xClient[topic][msg.action]);
            log.debug(arguments);
            // Iterate on all arguments and attach the relevnt parameters          
            async.map(  arguments,
                        function(item, callback){
                            try {
                                var parameter = parse_argument(item, msg);     
                                log.debug("PARAMETER "+ parameter);
                                callback(null, parameter);
                            } catch (e){
                                log.debug("ERROR "+ e);
                                callback(e, null);
                            }
                        },
                        function(err, result) {
                            if(!err) {                  
                                call_m2x(result ,msg);                            
                            } else {
                                log.error("Could not invoke call to m2x since " +
                                          "incoming node request could not be parsed, flow continued. [" +err + "]");                                
                                var err_msg = {};
                                err_msg.statusCode = INPUT_ERROR_CODE;
                                err_msg.payload = err;
                                _this.node.send(err_msg);
                            }
                        }
            );            
            
            
            function parse_argument(item, msg) {
                switch (item) {
                    case "id":
                    case "key":
                        return set_parameter(msg, msg.topic_id, "msg.topic_id is empty  for " + msg.action);
                        break;
                    case 'params' :
                    case 'values':
                        return set_parameter(msg, msg.payload, "msg.payload is empty  for " + msg.action);
                        break;
                    case 'name' :
                    case 'triggerID':
                    case 'triggerName':
                    case 'key':
                    case 'format':
                    case 'names':
                    case 'serial':
                        return set_parameter(msg, msg.sub_topic_id, "msg.sub_topic_id is empty  for " + msg.action);
                        break;
                    case 'callback':
                        return  function (error, response) {
                            _this.handle_msg_response(msg, error, response);
                        };
                }
            }
            
            function call_m2x(parameters, msg){        
                log.debug("TOPIC [" + topic + "] ACTIONS [" +msg.action + "]");
                _this.m2xClient[topic][msg.action].apply(_this.m2xClient[topic], parameters, function(msg, response) {
                        if(response && response.json) {
                            try{ 
                              log.debug("FINAL OUTPUT " +JSON.stringify(response.json));
                              var res_msg = {};                               
                              res_msg.payload = response.json;
                              res_msg.statusCode = response.status;
                            } catch(e) {
                              log.error("Failed to parse "+response + " As JSON, will return error instead");
                              res_msg.statusCode = OUTPUT_PARSE_ERROR;
                              res_msg.payload = "Cannot extract M2X output";
                            }
                        }                        
                        _this.node.send(res_msg);
                });                     
            };
        });

        function set_parameter(msg, msg_field, error_msg) {
            if (typeof (msg_field) === 'undefined') {
                _this.handle_msg_failure(msg, INPUT_ERROR_CODE, error_msg);
                throw "Cannot find message field " + error_msg;
            } else {
                return msg_field;
            }
        }
        function validate_msg(msg, msg_field, regex, error_code, error_msg) {
            if (typeof (msg_field) === 'undefined') {
                _this.handle_msg_failure(msg, error_code, error_msg);
            }
            var m;

            if ((m = regex.exec(msg_field)) === null) {
                _this.handle_msg_failure(msg, error_code, error_msg);
            }
        }

        function is_msg_succeed(error_code) {
            if (error_code <= 299 && error_code >= 200) {
                return true;
            }
            return false;
        }

        // If the success code is on the 2XX zone return true otherwise false
        _this.handle_msg_failure = function (msg, statusCode, reason) {
            try {
                if (typeof (statusCode) === 'undefined') {
                    _this.error("No result was found, setting error msg to 500 - General Error");
                    msg.statusCode = ERROR_CODE;
                } else {
                    _this.warn("M2X error execute returned " + statusCode);
                    msg.statusCode = statusCode;
                }
                if (typeof (reason) === 'undefined') {
                    msg.payload = {};
                } else if (!reason.body) {
                    msg.payload = reason;
                } else {
                    msg.payload = reason.body;
                }
            } finally {
                cleanForNextNode(msg);
                _this.send(msg);
            }
        };

        _this.handle_msg_response = function (msg, result) {
            if (!result || !result.status) {
                this.error("General Error on M2X Flow");
                this.handle_msg_failure(msg, ERROR_CODE, "Geneal Error");
            } else if (result.isError()) {
                var error_msg;
                if (result.json && result.json.message) {
                    error_msg = result.json.message;
                } else {
                    error_msg =  "Unknown Error";
                }
                this.handle_msg_failure(msg, result.status, error_msg);
            } else {
                log.info("Successful M2X Api call [" + result.status + "]");
                if (typeof (result.json) === 'undefined') {
                    msg.payload = result;
                } else {
                    msg.payload = result.json;
                }
                cleanForNextNode(msg);
                this.send(msg);
            }
        };
    }
    function M2XNodeAll(n) {
        RED.nodes.createNode(this, n);
        M2XNode(this, n);
    }

    RED.nodes.registerType("m2x", M2XNodeAll);
};

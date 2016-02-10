module.exports = function (RED) {
    var m2x = require('m2x');
    var log = require('log-driver').logger;
    var async = require('async');

    var M2X_ENDPOINT = "https://api-m2x.att.com/v2";

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
        RED.nodes.createNode(this, n);
        this.apiKey = n.apiKey;
        this.name   = n.name;
    }
    RED.nodes.registerType("m2x feed", M2XFeedNode);

    function M2XNode(config) {
        RED.nodes.createNode(this, config);

        var feedNode = RED.nodes.getNode(config.feed);
        var node = this;
        var m2xClient;

        this.on("input", function (msg) {
            if (typeof feedNode === 'undefined') {
                this.error("missing m2x feed configuration");
                return handle_msg_failure(msg, 401, "failure - missing M2X feed configuration");
            }

            m2xClient = new m2x(feedNode.apiKey, M2X_ENDPOINT);

            availableObjectsRegex = /distributions\b|devices\b|charts\b|keys\b/
            if(availableObjectsRegex.exec(msg.topic) === null) {
                return handle_msg_failure(msg, INPUT_ERROR_CODE, "msg.topic should one of distributions, devices, charts or keys");
            }

            var obj = m2xClient[msg.topic];

            // Get all methods and validate against msg.action
            var methods = getAllMethods(obj);
            if (!msg.action || methods.indexOf(msg.action) === -1) {
                this.error("invalid action on message");
                return handle_msg_failure(msg, INPUT_ERROR_CODE, "msg.action must be one of " + methods.join(", "));
            }

            if (typeof obj[msg.action] != 'function') {
                return handle_msg_failure(msg, INPUT_ERROR_CODE, "invalid " + msg.action +" method in " + msg.topic);
            }

            // Get list of parameters
            var arguments = getParamNames(obj[msg.action]);

            // Iterate on all arguments and attach the relevant parameters
            async.map(
                arguments,
                function(item, callback) {
                    try {
                        var parameter = parse_argument(item, msg);
                        log.debug("PARAMETER [" + item + "] Value [" + parameter +"]");
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
                        node.send(err_msg);
                    }
                }
            );
        });

        function parse_argument(item, msg) {
            switch (item) {
                case "id":
                case "key":
                    return set_parameter(msg, msg.topic_id, "msg.topic_id is empty  for " + msg.action);
                    break;
                case 'params' :
                    return set_parameter(msg, msg.payload, "msg.payload is empty  for " + msg.action, true);
                    break;
                case 'values':
                    return set_parameter(msg, msg.payload, "msg.payload is empty  for " + msg.action);
                    break;
                case 'name' :
                case 'triggerId':
                case 'triggerName':
                case 'key':
                case 'format':
                case 'names':
                case 'serial':
                    return set_parameter(msg, msg.sub_topic_id, "msg.sub_topic_id is empty  for " + msg.action);
                    break;
                case 'callback':
                    return  function (error, response) {
                        handle_msg_response(msg, error, response);
                    };
            }
        }

        function call_m2x(parameters, msg){
            m2xClient[msg.topic][msg.action].apply(m2xClient[msg.topic], parameters, function(msg, response) {
                if(response && response.json) {
                    var res_msg = {};
                    try{
                        log.debug("FINAL OUTPUT " +JSON.stringify(response.json));
                        res_msg.payload = response.json;
                        res_msg.statusCode = response.status;
                    } catch(e) {
                        log.error("Failed to parse "+response + " As JSON, will return error instead");
                        res_msg.statusCode = OUTPUT_PARSE_ERROR;
                        res_msg.payload = "Cannot extract M2X output";
                    }
                }
                node.send(res_msg);
            });
        };

        /**
         * Populate the parameters to the M2X Rest Clients API
         * @param {type} msg
         * @param {type} msg_field
         * @param {type} error_msg
         * @param {type} optional
         * @returns {undefined}
         */
        function set_parameter(msg, msg_field, error_msg, optional) {
            if (typeof msg_field === 'undefined') {
                if (optional === true) {
                    log.info(error_msg + " - Not mandatory, continue without");
                    return;
                }
                handle_msg_failure(msg, INPUT_ERROR_CODE, error_msg);
                throw "Cannot find message field " + error_msg;
            } else {
                return msg_field;
            }
        }

        // If the success code is on the 2XX zone return true otherwise false
        function handle_msg_failure (msg, statusCode, reason) {
            try {
                if (typeof (statusCode) === 'undefined') {
                    node.error("No result was found, setting error msg to 500 - General Error");
                    msg.statusCode = ERROR_CODE;
                } else {
                    node.warn("M2X error execute returned " + statusCode);
                    msg.statusCode = statusCode;
                }
                if (typeof reason === 'undefined') {
                    msg.payload = {};
                } else if (!reason.body) {
                    msg.payload = reason;
                } else {
                    msg.payload = reason.body;
                }
            } finally {
                cleanForNextNode(msg);
                node.send(msg);
            }
        }

        function handle_msg_response (msg, result) {
            if (!result || !result.status) {
                node.error("General Error on M2X node");
                handle_msg_failure(msg, ERROR_CODE, "General Error");
            } else if (result.isError()) {
                var error_msg;
                if (result.json && result.json.message) {
                    error_msg = result.json.message;
                } else {
                    error_msg =  "Unknown Error";
                }
                handle_msg_failure(msg, result.status, error_msg);
            } else {
                log.info("Successful M2X Api call [" + result.status + "]");
                if (typeof (result.json) === 'undefined') {
                    msg.payload = result;
                } else {
                    msg.payload = result.json;
                }
                cleanForNextNode(msg);
                node.send(msg);
            }
        }
    }

    RED.nodes.registerType("m2x", M2XNode);
};

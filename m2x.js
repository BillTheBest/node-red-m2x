module.exports = function (RED) {
    var m2x   = require("m2x");
    var log   = require("log-driver").logger;
    var async = require("async");

    var M2X_ENDPOINT = "https://api-m2x.att.com/v2";

    var SERVER_ERROR_CODE = 500;
    var INPUT_ERROR_CODE  = 400;

    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;

    function getParameterNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, "");
        var result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);
        if (result === null)
            result = [];
        return result;
    }

    function getAllMethods(object) {
        var methods = [];
        for (var member in object) {
            if (typeof object[member] === "function") {
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
           log.error("WARNING - Cannot delete msg input field, probably working on STRICT mode")
        }
    }

    function M2XNode(config) {
        RED.nodes.createNode(this, config);

        var feedNode = RED.nodes.getNode(config.feed);
        var node = this;
        var m2xClient;

        if (feedNode) {
            m2xClient = new m2x(feedNode.apiKey, M2X_ENDPOINT);
        }

        this.on("input", function (msg) {
            if (m2xClient === undefined) {
                return node.error("Missing m2x feed configuration");
            }

            availableObjectsRegex = /distributions\b|devices\b|charts\b|keys\b/
            if(availableObjectsRegex.exec(msg.topic) === null) {
                return handleFailure(msg, INPUT_ERROR_CODE, "msg.topic should one of distributions, devices, charts or keys");
            }

            var obj = m2xClient[msg.topic];

            // Get all methods and validate against msg.action
            var methods = getAllMethods(obj);
            if (methods.indexOf(msg.action) === -1) {
                this.error("Invalid action on message");
                return handleFailure(msg, INPUT_ERROR_CODE, "msg.action must be one of " + methods.join(", "));
            }

            if (typeof obj[msg.action] != "function") {
                return handleFailure(msg, INPUT_ERROR_CODE, msg.action + "is not a valid method for " + msg.topic);
            }

            // Get list of parameters
            var arguments = getParameterNames(obj[msg.action]);

            // Iterate on all arguments and attach the relevant parameters
            async.map(
                arguments,
                function(item, callback) {
                    var error, parameter = null;
                    try {
                        parameter = parseArgument(item, msg);
                        log.debug("PARAMETER [" + item + "] Value [" + parameter +"]");
                    } catch (e){
                        log.debug("ERROR "+ e);
                        error = e;
                    }
                    callback(error, parameter);
                },
                function(error, parameters) {
                    if(!error) {
                        m2xRequest(parameters, msg);
                    } else {
                        log.error("Failed to make request to M2X: " + err);
                        var errorMessage = {};
                        errorMessage.statusCode = INPUT_ERROR_CODE;
                        errorMessage.payload = err;
                        node.send(errorMessage);
                    }
                }
            );
        });

        function parseArgument(item, msg) {
            switch (item) {
                case "id":
                case "key":
                    return setParameter(msg, msg.topic_id, "msg.topic_id is empty for " + msg.action);
                    break;
                case "params":
                    return setParameter(msg, msg.payload, "msg.payload is empty for " + msg.action, true);
                    break;
                case "values":
                    return setParameter(msg, msg.payload, "msg.payload is empty for " + msg.action);
                    break;
                case "name":
                case "triggerId":
                case "triggerName":
                case "format":
                case "names":
                case "serial":
                    return setParameter(msg, msg.sub_topic_id, "msg.sub_topic_id is empty for " + msg.action);
                    break;
                case "callback":
                    return function (error, response) {
                        handleResponse(msg, error, response);
                    };
            }
        }

        function m2xRequest(parameters, msg){
            m2xClient[msg.topic][msg.action].apply(m2xClient[msg.topic], parameters, function(msg, response) {
                var resultMsg = {};
                if(response && response.json) {
                    resultMsg.payload    = response.json;
                    resultMsg.statusCode = response.status;
                } else {
                    log.error("Failed to parse " + response + " as JSON, will return error instead");
                    resultMsg.statusCode = 500;
                    resultMsg.payload = "Cannot extract M2X output: " + response;
                }
                node.send(resultMsg);
            });
        }

        /**
         * Populate the parameters to the M2X Rest Clients API
         * @param {type} msg
         * @param {type} field
         * @param {type} errorMessage
         * @param {type} optional
         */
        function setParameter(msg, field, errorMessage, optional) {
            if (typeof field === "undefined") {
                if (optional === true) {
                    return;
                }
                handleFailure(msg, INPUT_ERROR_CODE, errorMessage);
                throw "Cannot find message field " + errorMessage;
            } else {
                return field;
            }
        }

        function handleFailure(msg, statusCode, reason) {
            try {
                if (typeof statusCode === "undefined") {
                    node.error("No result was found, setting error msg to 500 - General Error");
                    msg.statusCode = SERVER_ERROR_CODE;
                } else {
                    node.warn("Error code returned: " + statusCode);
                    msg.statusCode = statusCode;
                }
                if (typeof reason === "undefined") {
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

        function handleResponse(msg, result) {
            if (!result || !result.status) {
                node.error("General Error on M2X node");
                handleFailure(msg, SERVER_ERROR_CODE, "General Error");
            } else if (result.isError()) {
                var errorMessage;
                if (result.json) {
                    if (result.json.message) {
                        errorMessage = result.json.message;
                    } else {
                        errorMessage = result.json;
                    }
                } else {
                    errorMessage = "Unknown Error: ";
                }

                handleFailure(msg, result.status, errorMessage);
            } else {
                log.debug("Successful M2X API call: " + result.status);
                if (typeof result.json === "undefined") {
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

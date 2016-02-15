module.exports = function (RED) {
    var m2x   = require("m2x");
    var async = require("async");

    var M2X_ENDPOINT = "https://api-m2x.att.com/v2";

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
                return node.error("Missing m2x feed configuration", msg);
            }

            availableObjects = ["collections", "commands", "devices", "distributions", "jobs", "keys"]

            if(availableObjects.indexOf(msg.topic) === -1) {
                return node.error("msg.topic should be one of " + availableObjects.join(", "), msg);
            }

            var obj = m2xClient[msg.topic];

            // Get all methods and validate against msg.action
            var methods = getAllMethods(obj);
            if (methods.indexOf(msg.action) === -1) {
                return node.error("msg.action must be one of " + methods.join(", "), msg);
            }

            if (typeof obj[msg.action] != "function") {
                return node.error(msg.action + " is not a valid method for " + msg.topic, msg);
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
                    } catch (e){
                        error = e;
                    }
                    callback(error, parameter);
                },
                function(error, parameters) {
                    if(error) {
                        return node.error("Error creating the request payload: " + error, msg)
                    }
                    node.status({ fill: "red", shape: "dot", text: "Runnig" });
                    m2xClient[msg.topic][msg.action].apply(m2xClient[msg.topic], parameters);
                }
            );
        });

        function parseArgument(item, msg) {
            switch (item) {
                case "id":
                case "key":
                    return setParameter(msg, msg.topic_id, "msg.topic_id is empty for '" + msg.action + "'");
                    break;
                case "params":
                    return setParameter(msg, msg.payload, "msg.payload is empty for '" + msg.action + "'", true);
                    break;
                case "values":
                    return setParameter(msg, msg.payload, "msg.payload is empty for '" + msg.action + "'");
                    break;
                case "name":
                case "format":
                case "names":
                case "serial":
                    return setParameter(msg, msg.sub_topic_id, "msg.sub_topic_id is empty for '" + msg.action + "'");
                    break;
                case "callback":
                    return function (response) {
                        handleResponse(msg, response);
                    };
            }
        }

        /**
         * Populate the parameters to the M2X Rest Clients API
         * @param {type} msg
         * @param {type} field
         * @param {type} errorMessage
         * @param {type} optional
         */
        function setParameter(msg, field, errorMessage, optional) {
            if (!field) {
                if (optional) {
                    return;
                }
                throw errorMessage;
            } else {
                return field;
            }
        }

        function handleResponse(msg, response) {
            node.status({});

            if (!response) {
                return node.error("Failed to get a response from M2X API");
            }

            node.statusCode = response.status;

            if (!response.json) {
                node.warn("Failed to parse response as JSON");
                msg.payload = response.raw;
            } else {
                msg.payload = response.json;
            }

            if (response.isError()) {
                var errorMessage = "Error reported from M2X API";

                if (msg.payload.message) {
                    errorMessage += ": " + msg.payload.message;
                }

                node.error(errorMessage, msg);
            }

            node.send(msg);
        }
    }
    RED.nodes.registerType("m2x", M2XNode);
};

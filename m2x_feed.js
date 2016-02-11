module.exports = function (RED) {
    function M2XFeedNode(n) {
        RED.nodes.createNode(this, n);
        this.apiKey = n.apiKey;
        this.name   = n.name;
    }
    RED.nodes.registerType("m2x feed", M2XFeedNode);
};

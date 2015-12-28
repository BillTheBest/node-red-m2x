/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var flow_initer = require("./flow_init.js");
var should = require("should");
var m2xNode = require("../../../node_modules/node-red-m2x/m2x.js");
var helper = require("../helper.js");



describe('m2x node', function() {

    before(function(done) {
        helper.startServer(done);
    });

    afterEach(function() {
        helper.unload();
    });

   it('list chart', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log("%j", msg);
                msg.payload.charts.should.be.an.Array;
                done();
            });
            n1.receive({topic  : "charts",
                        action : "list"});
        });
    });


    it('should update chart', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.status.should.within(200,299);
                done();
            });
            n1.receive({payload:{ series : [
                                            {device: "1b2f98cc3b31b527c27ba14fe46c615c", stream:"humidity"}]},
                        topic: "charts",
                        topic_id : "f149a94a715fa12455c9ad53f7b18e42",
                        action : "update"});
        });
    });

    it('should delete chart', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.status.should.within(200,299);
                done();
            });
            n1.receive({topic: "charts",
                        topic_id : "4f47718169f760d92a5241415a3b3caa",
                        action : "deleteChart"});
        });
    });

});

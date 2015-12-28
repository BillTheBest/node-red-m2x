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

    it('should create distribution', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.payload.should.have.properties({
                         "name"        : "test_distrib",
                         "description" : "m2x node red testing distrib",
                         "visibility"  : "private"});
                     done();
                 });
                 n1.receive({topic  : "distributions",
                             action : "create",
                             payload : { "name"        : "test_distrib",
                                         "description" : "m2x node red testing distrib",
                                         "visibility"  : "private",
                                         "base_device" : "654f4684d54a88591c2b1f1da0fd621a"}
                            });
        });
    });

    it('should create device', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.payload.should.have.properties({
                         "name"        : "testing_distrib",
                         "description" : "m2x node red testing distrib",
                         "visibility"  : "private"});
                     done();
                 });
                 n1.receive({topic  : "distributions",
                             action : "addDevice",
                             topic_id : "1ee40764159d8b7bbc51e79916309e85",
                             sub_topic_id : "testing_distrib_device",
                             payload : { "name"        : "test_distrib",
                                         "description" : "m2x node red testing distrib",
                                         "visibility"  : "private",
                                         "base_device" : "654f4684d54a88591c2b1f1da0fd621a"}
                            });
        });
    });
    //TODO:  SHOULD Be run with -t 5000
    it('should create trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.payload.should.have.properties({
                         "stream": "test_stream_distrib",
                         "name": "test_trigger_distrib3",
                         "condition": ">",
                         "value": 30,
                         "callback_url": "https://scrum-api-flow.att.io/sandbox/https/chenfli/in/flow",
                         "status": "enabled"});
                     done();
                 });
                 n1.receive({payload:{ "stream": "test_stream_distrib",
                                       "name": "test_trigger_distrib3",
                                       "condition": ">",
                                       "value": 30,
                                       "callback_url": "https://scrum-api-flow.att.io/sandbox/https/chenfli/in/flow",
                                       "status": "enabled" },
                             topic    : "distributions",
                             action   : "createTrigger",
                             topic_id : "1ee40764159d8b7bbc51e79916309e85"});
        });
     });


    it('should delete trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.status.should.within(200, 299);
                     done();
                 });
                 n1.receive({topic    : "distributions",
                             action   : "deleteTrigger",
                             topic_id : "1ee40764159d8b7bbc51e79916309e85",
                             sub_topic_id :"AUtanUPpTjhBGEzH1rnX" });
        });
     });

    it('should delete distribution', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.status.should.within(200, 299);
                     done();
                 });
                 n1.receive({topic    : "distributions",
                             action   : "deleteDistribution",
                             topic_id : "c145918984bf63dfcd6c94d2b0e07dc4"});
        });
     });

    it('should delete a data stream', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
                 var n1 = helper.getNode("m2xn1");
                 var n2 = helper.getNode("m2xn2");
                 n2.on("input", function(msg) {
                     console.log(msg);
                     msg.status.should.within(200, 299);
                     done();
                 });
                 n1.receive({topic    : "distributions",
                             action   : "deleteDistribution",
                             topic_id : "3d6ecf7f2e3561dfc1a6bea16182a29f",
                             sub_topic_id : "Thermo"});
        });
     });
});

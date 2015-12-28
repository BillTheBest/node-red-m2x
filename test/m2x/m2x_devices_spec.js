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

    it('should be loaded', function(done) {
        var flow = [{"id":"m2xFeed","type":"m2x feed","apiKey":"YOUR_M2X_ACCOUNT_ID","name":"My M2x node"},
		  {"id":"m2xNode1","type":"m2x","feed":"m2xFeed","name" : "m2x"}];
        helper.load(m2xNode, flow, function() {
            var m2xNode1 = helper.getNode("m2xNode1");
            m2xNode1.should.have.property("name", "m2x");
            done();
        });
    });

    it('should invoke devices catalog', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.should.have.properties({
                    "limit": '5'
                });
                msg.payload.devices.should.be.an.Array;
                done();
            });
            n1.receive({payload:{ "q" : "m2x","limit" : "5"}, topic: "devices", action : "catalog"});
        });
    });
    it('should create new device', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                msg.payload.should.have.properties({
                    "name" : "testing",
                    "description" : "A Testing device",
                    "visibility" : "private"
                });
                done();
            });
            n1.receive({payload:{ "name" : "testing",
                                  "description" : "A Testing device",
                                  "visibility" : "private"},
                        topic  : "devices",
                        action : "create"});
        });
    });
    it('should delete device', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.status.should.equals("204");
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "deleteDevice",
                        topic_id : "cae50230e5787523e14441a37defdbfd"});
        });
    });

    it('should post single stream values', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.status.should.within(200,299);
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "postValues",
                        topic_id : "654f4684d54a88591c2b1f1da0fd621a",
                        sub_topic_id : "heat",
                        payload  : [ {"timestamp" : new Date().toJSON(), "value" : "111"}]

                });
        });
    });


    it('delete stream values', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.status.should.equals("204");
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "deleteStreamValues",
                        topic_id : "654f4684d54a88591c2b1f1da0fd621a",
                        sub_topic_id : "heat",
                        payload : { "from": "2014-09-09T19:15:00.624Z",
                                    "end": "2015-09-09T20:15:00.522Z" }});
        });
    });


    it('should create new trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                console.log(msg);
                msg.payload.should.have.properties({
                    "stream": "temperature",
                    "name": "High temperature",
                    "condition": ">",
                    "value": 30,
                    "callback_url": "https://scrum-api-flow.att.io/sandbox/https/chenfli/in/flow/denis",
                    "status": "enabled",
                    "send_location": true});
                done();
            });
            n1.receive({payload:{ "stream": "temperature",
                                  "name": "High temperature",
                                  "condition": ">",
                                  "value": 30,
                                  "callback_url": "https://scrum-api-flow.att.io/sandbox/https/chenfli/in/flow/denis",
                                  "status": "enabled",
                                  "send_location": true },
                        topic    : "devices",
                        action   : "createTrigger",
                        topic_id : "1b2f98cc3b31b527c27ba14fe46c615c"});
        });
    });
    it('should view trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                msg.payload.should.have.properties({
                    "stream": "temperature",
                    "name": "hot",
                    "condition": ">",
                    "value": 200,
                    "callback_url": "http://localhost:1880/hot",
                    "status": "disabled",
                    "send_location": true});
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "trigger",
                        topic_id : "1b2f98cc3b31b527c27ba14fe46c615c",
                        sub_topic_id : "AUtGaZbkTjhBGEzH1DCo"});
        });
    });
    it('should list trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                msg.payload.triggers.should.be.an.Array;
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "triggers",
                        topic_id : "1b2f98cc3b31b527c27ba14fe46c615c"});
        });
    });
    it('should update trigger', function(done) {
        var flow = flow_initer.build_flow();
        helper.load(m2xNode, flow, function() {
            var n1 = helper.getNode("m2xn1");
            var n2 = helper.getNode("m2xn2");
            n2.on("input", function(msg) {
                msg.payload.status.should.equal(204);
                done();
            });
            n1.receive({topic    : "devices",
                        action   : "updateTrigger",
                        topic_id : "1b2f98cc3b31b527c27ba14fe46c615c",
                        sub_topic_id : "AUtpxLWkTjhBGEzH2Jli",
                        payload  : {"value": 200}});
        });
    });
});

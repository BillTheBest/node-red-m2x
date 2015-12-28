/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
// Create the basic flow including m2x feed configuration

exports.build_flow = function(){
    var flow = [{id:"m2xFeed", type:"m2x feed",apiKey:"YOUR_M2X_ACCOUNT_ID",name:"My M2x node"},
                {id:"m2xn1", type:"m2x",feed:"m2xFeed", wires:[["m2xn2"]]},
                {id:"m2xn2", type:"helper"}];
    return flow;
}

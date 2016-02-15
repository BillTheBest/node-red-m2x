![Logo](md_images/logo.png)

# Node-RED M2X Node

A [Node-RED](http://nodered.org) node used to store time-series data in [AT&T's M2X](https://m2x.att.com). This node is also included out-of-the-box with [AT&T's Flow Designer](http://flow.att.com).

[AT&T M2X](http://m2x.att.com) is a cloud-based fully managed time-series data storage service for network connected machine-to-machine (M2M) devices and the Internet of Things (IoT).

## Installation

This node is available as an [npm package](https://www.npmjs.com/package/node-red-m2x). Run the following command in the root directory of your Node-RED Directory:

```bash
npm install node-red-m2x
```

## Usage

Use node-red-m2x to store time-series data from anything in [AT&T M2X](http://m2x.att.com) and manage your M2X devices.

On its core, this node uses the [M2X NodeJS client library](https://github.com/attm2x/m2x-nodejs) and maps the `msg` properties to prototypes and methods of said library.

The accepted properties are:
- **msg.topic** (required) - The type of object to act on, it corresponds with the prototypes defined on the M2X NodeJS client libraries (collections, commands, devices, distributions, jobs, keys).
- **msg.action** (required) - An action to be applied for this type of object, corresponds with the methods defined for the entity specified in **msg.topic**.
- **msg.topic_id** (optional) - The unique identifier to be passed to the method defined on **msg.action**.
- **msg.sub_topic_id** (optional) - The unique identifier of an instance relative to the **msg.topic_id** (e.g.: msg.topic_id could be a device id and msg.sub_topic_id could be a stream or trigger id)
- **msg.payload** (optional) - A JSON object that will be the body of the request when applicable.

## Authentication

Use the `m2x feed` configuration node to set your M2X API Key

## Examples

### Listing devices:

```javascript
msg = {
    topic: "devices",
    action: "list"
}
```

### Viewing a device:

```javascript
msg = {
    topic: "devices",
    action: "view",
    topic_id: "65b89448f954f49e42b746d73b385cbb"
}
```

### Viewing a stream of a device:

```javascript
msg = {
    topic: "devices",
    action: "stream",
    topic_id: "65b89448f954f49e42b746d73b385cbb",
    sub_topic_id: "temperature"
}
```

## Development

This repository includes a `Dockerfile` that makes it easier to launch a local instance of node-red and test the M2X node.

Make sure to have a running version of docker on your computer.

### Building the image

```bash
make build
```

### Creating the container

```bash
make create
```

After executing those steps, you will get a new container ready for development, you can see it by executing `docker ps -a` and start it with `docker start node-red`. Once the container is ready, node-red will be running and listening for connections on the port 1880 of your docker host.

## Helpful Resources ##

* [Signup for an AT&T M2X Account](https://m2x.att.com/signup)
* [M2X API Documentation](https://m2x.att.com/developer/documentation/overview)
* [M2X NodeJS client library](https://github.com/attm2x/m2x-nodejs)
* [Get started with AT&T Flow Designer Account](https://flow.att.com/start)
* [Node-RED Documentation](http://nodered.org/docs/)
* [Running Node-Red](http://nodered.org/docs/getting-started/running.html)

## License ##

This software is provided under the MIT license. See [LICENSE](LICENSE) for applicable terms.

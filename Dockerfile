FROM node:4.2

RUN npm install -g node-red

WORKDIR "/root/.node-red"

ADD ["package.json", "/root/.node-red/"]

RUN npm install

VOLUME /root/.node-red/node_modules/node-red-m2x/

EXPOSE 1880

ENTRYPOINT ["/usr/local/bin/node-red"]

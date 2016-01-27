LABEL="m2x/node-red"
M2X_NODE_PATH="/root/.node-red/node_modules/node-red-m2x"

build:
	docker build -t ${LABEL} ${PWD}

create: build
	docker create -p 1880:1880 -v ${PWD}:${M2X_NODE_PATH} --name="node-red" ${LABEL}

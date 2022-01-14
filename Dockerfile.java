#################################
# Pipy Builder
#################################
FROM node:12.22.9-buster-slim as pipy-builder

ARG WORK_DIR=/workspace
ARG PIPY_DIR=${WORK_DIR}/pipy

WORKDIR ${WORK_DIR}

ENV CXX=clang++
ENV CC=clang

# # install dependencies
RUN \
    apt update \
 && apt install -y openssh-client git cmake clang zlib1g zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

# build 
RUN cd ${WORK_DIR} \
    && git clone https://github.com/flomesh-io/pipy.git \
    && cd ${PIPY_DIR} \
    && npm install \
    && npm run build \
    && mkdir -p ${PIPY_DIR}/build \
    && cd ${PIPY_DIR}/build \
    && cmake -DPIPY_GUI=OFF -DPIPY_TUTORIAL=OFF -DCMAKE_BUILD_TYPE=Release ${PIPY_DIR} \
    && make

#################################
# Graalvm Builder
#################################
FROM addozhang/graalvm-maven:java17-21.3 as java-builder

WORKDIR /workspace
COPY src/java/ ./

RUN mvn -Pnative -DskipTests package

#################################
# Final Image
#################################
FROM debian:stable-slim

ARG WORK_DIR=/workspace
ARG PIPY_DIR=${WORK_DIR}/pipy

WORKDIR /func
ENV TARGET_PORT=3000
ENV MAX_IDLE_TIME=10
ENV TARGET_ENTRY='./helloworld'

COPY --from=pipy-builder ${PIPY_DIR}/bin/pipy /usr/local/bin
COPY --from=java-builder ${WORK_DIR}/target/helloworld ./
COPY pipy.js pipy.js

EXPOSE 8080

ENTRYPOINT ["pipy", "pipy.js"]    
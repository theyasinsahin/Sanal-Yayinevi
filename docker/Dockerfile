# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
FROM docker:27.5.1-cli@sha256:851f91d241214e7c6db86513b270d58776379aacc5eb9c4a87e5b47115e3065c AS docker-cli
FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS base
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git openssh-client python3 util-linux libcurl4 libgssapi-krb5-2 libssl3 liblzma5 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global npm@11.13.0 --no-audit --no-fund \
    && if [ "$(id -g node)" != "$LOCAL_GID" ]; then groupmod -g "$LOCAL_GID" node; fi \
    && if [ "$(id -u node)" != "$LOCAL_UID" ]; then usermod -u "$LOCAL_UID" node; fi \
    && chown -R node:node /home/node \
    && test "$(node --version)" = v26.13.0 && test "$(npm --version)" = 11.13.0
ENV MONGOMS_DISABLE_POSTINSTALL=1 NPM_CONFIG_UPDATE_NOTIFIER=false

FROM base AS dependencies
WORKDIR /workspace/Server
COPY Server/package.json Server/package-lock.json ./
RUN --mount=type=cache,id=betik-server-npm,target=/root/.npm \
    npm ci --no-audit --no-fund \
    && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.betik-lock
WORKDIR /workspace/Client
COPY Client/package.json Client/package-lock.json ./
RUN --mount=type=cache,id=betik-client-npm,target=/root/.npm \
    npm ci --no-audit --no-fund \
    && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.betik-lock

FROM base AS development
ARG BETIK_WORKSPACE_PATH=/workspace
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/ /usr/local/libexec/docker/cli-plugins/
COPY --from=dependencies --chown=node:node /workspace/Server/node_modules ${BETIK_WORKSPACE_PATH}/Server/node_modules
COPY --from=dependencies --chown=node:node /workspace/Client/node_modules ${BETIK_WORKSPACE_PATH}/Client/node_modules
COPY --chown=node:node docker/entrypoint.sh /opt/betik/entrypoint.sh
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node
WORKDIR ${BETIK_WORKSPACE_PATH}
USER node
ENTRYPOINT ["bash", "/opt/betik/entrypoint.sh"]
CMD ["sleep", "infinity"]

FROM dependencies AS checks
ENV MONGOMS_VERSION=8.0.34 MONGOMS_DOWNLOAD_DIR=/opt/mongodb-binaries
WORKDIR /workspace
RUN mkdir -p /opt/mongodb-binaries \
    && node -e "require('./Server/node_modules/mongodb-memory-server-core/lib/util/MongoBinary').MongoBinary.getPath({version: process.env.MONGOMS_VERSION}).then(() => console.log('MongoDB test binary ready'))" \
    && mkdir -p /workspace/Client/node_modules/.cache /workspace/Server/node_modules/.cache \
    && chown node:node /workspace /workspace/Client /workspace/Server /workspace/Client/node_modules/.cache /workspace/Server/node_modules/.cache \
    && chown -R node:node /opt/mongodb-binaries
COPY --chown=node:node . /workspace
ENV NODE_ENV=test CI=true MONGOMS_RUNTIME_DOWNLOAD=false \
    REACT_APP_API_URL=http://127.0.0.1:5001 \
    REACT_APP_WS_URL=ws://127.0.0.1:5001/graphql \
    REACT_APP_GOOGLE_CLIENT_ID=synthetic-ci-client.apps.googleusercontent.com \
    REACT_APP_CLOUDINARY_CLOUD_NAME=synthetic-ci-cloud \
    REACT_APP_CLOUDINARY_UPLOAD_PRESET=synthetic-ci-preset
USER node
CMD ["bash", "docker/checks.sh", "unit"]

FROM checks AS browser
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN cd /workspace/Client && npx --no-install playwright install --with-deps chromium \
    && chown -R node:node /opt/playwright-browsers
USER node
CMD ["bash", "docker/checks.sh", "browser"]

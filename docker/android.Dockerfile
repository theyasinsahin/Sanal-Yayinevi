# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
FROM eclipse-temurin:21-jdk-noble@sha256:114cabb73033ca4ce7ceec3deb62396bc1b716282bae051ed3c1d82e38fcab2d AS jdk
FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip util-linux libfreetype6 fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global npm@11.13.0 --no-audit --no-fund \
    && if [ "$(id -g node)" != "$LOCAL_GID" ]; then groupmod -g "$LOCAL_GID" node; fi \
    && if [ "$(id -u node)" != "$LOCAL_UID" ]; then usermod -u "$LOCAL_UID" node; fi
COPY --from=jdk /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/home/node/.gradle \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    REACT_APP_DOCKER_DEV=true \
    REACT_APP_DEV_INTEGRATIONS=false \
    REACT_APP_GOOGLE_CLIENT_ID="" \
    REACT_APP_CLOUDINARY_CLOUD_NAME="" \
    REACT_APP_CLOUDINARY_UPLOAD_PRESET=""
ENV PATH="${JAVA_HOME}/bin:${PATH}"
RUN test "$(node --version)" = v26.13.0 && test "$(npm --version)" = 11.13.0 \
    && java -XshowSettings:properties -version 2>&1 | grep 'java.version = 21' \
    && mkdir -p /opt/android-sdk /home/node/.gradle /home/node/.android /artifacts \
    && chown -R node:node /opt/android-sdk /home/node /artifacts
WORKDIR /workspace/Client
COPY Client/package.json Client/package-lock.json ./
RUN --mount=type=cache,id=betik-client-npm,target=/root/.npm npm ci --no-audit --no-fund
COPY --chown=node:node Client/ ./
COPY docker/android.sh /opt/betik/android.sh
RUN mkdir -p /workspace/Client/node_modules/.cache \
    && chown node:node /workspace /workspace/Client /workspace/Client/node_modules/.cache \
    && chown -R node:node /workspace/Client/node_modules/@capacitor/android
USER node
ENTRYPOINT ["bash", "/opt/betik/android.sh"]
CMD ["doctor"]

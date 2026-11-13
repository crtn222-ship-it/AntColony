#!/bin/sh
# Gradle start script for the AntColony project (POSIX sh).
APP_BASE_NAME=`basename "$0"`
APP_HOME=`cd "${0%/*}" >/dev/null 2>&1 && pwd`
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
if [ ! -f "$CLASSPATH" ]; then
  echo "gradle-wrapper.jar is missing. Open the project in Android Studio once and it will be generated, or copy it from any Gradle distribution." >&2
  exit 1
fi
exec java -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"

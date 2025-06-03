#!/bin/bash

# Set paths
MONOREPO_DIR="/home/minelert/smartlink_uio_node_red"
NODERED_DIR="$HOME/.node-red"

echo "Installing workspace dependencies..."
cd "$MONOREPO_DIR" || exit 1
npm install

echo "Linking packages to Node-RED locally..."
cd "$NODERED_DIR" || exit 1

# Read workspaces from root package.json
WORKSPACES=$(jq -r '.workspaces[]' "$MONOREPO_DIR/package.json")

# Link each workspace directly to Node-RED
for WS_PATH in $WORKSPACES; do
  for PKG_JSON in "$MONOREPO_DIR"/$WS_PATH/package.json; do
    if [ -f "$PKG_JSON" ]; then
      PKG_DIR=$(dirname "$PKG_JSON")
      PKG_NAME=$(jq -r .name "$PKG_JSON")
      echo "Installing $PKG_NAME from $PKG_DIR"
      npm install "$PKG_DIR"
    fi
  done
done

echo "Restarting Node-RED..."
sudo systemctl restart nodered || echo "Could not restart Node-RED automatically. Please do it manually."

echo "Done. Node-RED is now linked with all workspace packages."
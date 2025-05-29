<p align="center" >
    <img src="logo.png">
</p>

<p align="center" >
    <a href="https://github.com/42fm/server/actions">
        <img src="https://github.com/42fm/server/workflows/CI/badge.svg">
    </a>
</p>

## Overview

This repository contains the backend server for the [42FM browser extension](https://github.com/42fm/42fm). It manages real-time synchronization of music playback across multiple extension users.

## Development Setup with docker compose

1. Clone repo

   ```sh
   git clone https://github.com/42fm/server.git --recursive
   ```

1. Navigate to the project directory

   ```sh
   cd server
   ```

1. Build and start the containers

   ```sh
   docker compose up --build --watch
   ```

## Related Projects

- [42FM Browser Extension](https://github.com/42fm/42fm) - The client-side browser extension

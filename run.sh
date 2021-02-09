cd /home/ubuntu/holy-instinctive-cork
podman run -p 0.0.0.0:3001:8080/tcp --mount type=bind,source="$(pwd)",target=/src node bash -c 'cd /src && npm install && npm start'

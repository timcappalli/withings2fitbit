# Use a smaller base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Define the command to run your app
CMD [ "node", "app.js" ]
# pull official base image
FROM node:12.18.3-stretch as dev

WORKDIR /app
# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH
# install app dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install --silent
 # Submodule with header is assumed to be copied beforehand 
COPY . ./
EXPOSE 3000
CMD ["npm", "start"]

# Production Layers
FROM dev as prod
ARG env_file=.env.prod
RUN cp $env_file .env
RUN npm run build

FROM nginx:stable-alpine as static
# Copy stuff for nginx
COPY --from=prod /app/dist /usr/share/nginx/html
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
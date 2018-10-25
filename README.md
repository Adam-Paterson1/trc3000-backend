# trc3000-backend
Node backend for the balancing robot.
Requires minimu9-ahrs by David Grayson, but we did mod it out a little bit to get it to work - the word expansion didn't seem to like running from the context of Node so we hardcoded it instead. Also changed the period to 10ms for the loop pacer.
Use npm run build in the frontend repository and have trc3000-frontend situated next to this folder and it will be able to serve the prod build of the dashboard.

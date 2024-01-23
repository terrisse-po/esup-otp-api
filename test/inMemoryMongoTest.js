import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { promisify } from 'util';

import * as properties from '../properties/properties.js';
import * as apiDb from '../databases/api/mongodb.js';
import * as userDb from '../databases/user/mongodb.js';
import * as userDb_controller from '../controllers/user.js';
import * as api_controller from '../controllers/api.js';
import * as server from '../server/server.js';

/**
 * @type MongoMemoryServer
 */
let mongoMemoryServer;

export async function initialise() {
    // use in memory mongodb
    properties.setEsupProperty("apiDb", "mongodb");
    properties.setEsupProperty("userDb", "mongodb");

    mongoMemoryServer = await MongoMemoryServer.create({ instance: { dbName: "test-otp" } });
    const mongoUri = mongoMemoryServer.getUri();

    await apiDb.initialize(mongoUri);
    await userDb.initialize(mongoUri);
    await api_controller.initialize(apiDb);
    await userDb_controller.initialize(userDb);
    await server.initialize_routes();
    await server.launch_server(0);

    return server.server;
}

export async function stop() {
    await mongoose.disconnect();
    await mongoMemoryServer.stop();
    await promisify(server.server.close).call(server.server);

    console.log("MongoMemoryServer stopped");
}

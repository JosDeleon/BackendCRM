const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');

const jwt = require("jsonwebtoken");

require("dotenv").config({ path: "variables.env" });

const conectarDB = require('./config/db');

//Conectar DB
conectarDB();

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => {
        //console.log(req.headers)
        const token = req.headers['authorization'] || '';
        if (token) {
            try {
                const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRETA);
          //      console.log(usuario);
                return{
                    usuario
                }
            } catch (error) {
                console.log('Hubo un error');
                console.log(error);
            }
        }
    }
});

server.listen( process.env.PORT || 4000 ).then(({url}) => {
    console.log(`Servidor listo en ${url}`);
});


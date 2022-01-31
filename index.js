import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi'

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
const mongoClient = new MongoClient(process.env.MONGO_URI);

/*setInterval(remocaoAutomatica, 15000);*/

async function remocaoAutomatica(){
    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('usuarios');
    const resultado = await collection.find().toArray();
    if(resultado){
        for(let i = 0; i< resultado.length-1; i++){
            const agora = Date.now();
            if (agora - resultado[i].lastStatus >= 10000){
                await collection.deleteOne({name: resultado[i].name});
                const collection2 = db.collection('mensagensStatus');
                await collection2.insertOne({from: resultado[i].name, to: "Todos", text: "Sai da sala...", type: "status", time: dayjs().format('HH:mm:ss')});
            }
        }
    }
    mongoClient.close();
}

app.post("/participants", async (req, res) => {

    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('usuarios');
    const array = {name: req.body.name};
    const userSchema = joi.object({
        name: joi.string().required()
    });
    const validation = userSchema.validate(array, { abortEarly: true });
    if(await collection.findOne({name: req.body.name})){
        res.sendStatus(409);
        mongoClient.close();
    }
    else if(validation.error) {
        res.sendStatus(422);
        mongoClient.close();
    }
    else{
        const resultado = await collection.insertOne({name: req.body.name, lastStatus: Date.now()});
        const collection2 = db.collection('mensagensStatus');
        const resultado2 = await collection2.insertOne({name: req.body.name, to: "Todos", text: "Entra na sala...", type: "status", time: dayjs().format('HH:mm:ss')});
        res.sendStatus(201);
        mongoClient.close();
    }
})

app.get("/participants", async (req, res) => {

    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('usuarios');
    const resultado = await collection.find().toArray();
    res.send(resultado);
    mongoClient.close();
})

app.post("/messages", async (req, res) => {

    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('mensagens');
    const collection2 = db.collection('usuarios');
    const array = {to: req.body.to, text: req.body.text, type: req.body.type};
    const userSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid('message', 'private_message').required(),
    });
    const validation = userSchema.validate(array, { abortEarly: true });
    if(!await collection2.findOne({name: req.headers.user})){
        res.sendStatus(409);
        mongoClient.close();
    }
    else if (validation.error) {
        res.sendStatus(422);
        mongoClient.close();
    }
    else{
        const resultado = await collection.insertOne({from: req.headers.user, to: req.body.to, text: req.body.text, type: req.body.type, time: dayjs().format('HH:mm:ss')});
        res.sendStatus(201);
        mongoClient.close();
    }
})

app.get("/messages", async (req, res) => {

    const limit = parseInt(req.query.limit);
    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('mensagens');
    const resultado = await collection.find().toArray();
    if (limit && limit < resultado.length){
        let resultadoLimitado = [];
        for(let i = resultado.length-1; i< resultado.length-limit-1;i--){
            resultadoLimitado.unshift(resultado[i]);
        }
        res.send(resultadoLimitado);
    }
    else{
        res.send(resultado);
    }
    mongoClient.close();
})

app.get("/status", async (req, res) => {

    const clientConnected = await mongoClient.connect();
    const db = clientConnected.db("batepapouol");
    const collection = db.collection('usuarios');
    const resultado = await collection.findOne({name: req.headers.user});
    if (resultado){
        await collection.updateOne({ 
			name: req.headers.user 
		}, { $set: 
            {
                name: req.body.name, lastStatus: Date.now()
            }
        })
        res.sendStatus(200);
    }
    else{
        res.sendStatus(404);
    }
    mongoClient.close();
})

app.listen(5000, () =>{
    console.log("Rodando");
});
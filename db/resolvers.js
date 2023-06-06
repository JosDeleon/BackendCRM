const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

const resolvers = {
  Query: {
    obtenerUsuario: async (_, {  }, ctx) => {
      return ctx.usuario; 
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error)
      }
    },
    obtenerProducto: async (_, { id }) => {
      //revisar si exsite
      const producto = await Producto.findById(id);
      console.log(producto)
      if(!producto){
        throw new Error('Producto no encontrado');
      }
      return producto;
    },
    obtenerCliente: async (_, { id }, ctx ) => {
      try {
        //Revisar si el cliente existe 
        const cliente = await Cliente.findById(id);
        if(!cliente){
          throw new Error('Cliente no encontrado');
        } 

        //Solo quien lo creo puede verlo
        if(cliente.vendedor.toString() !== ctx.usuario.id ){
          throw new Error('No tiene credenciales');
        }

        return cliente;
      } catch (error) {
        console.log(error)
      }
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error)
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx ) => {
      try {
          const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });
          return clientes;
      } catch (error) {
          console.log(error);
      }
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error)
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente');
        return pedidos;
      } catch (error) {
        console.log(error)
      }
    },
    obtenerPedido: async (_, {id}, ctx) => {
      const pedido = await Pedido.findById(id);
      if (!existeUsuario) {
        throw new Error("Pedido No Encontrado");
      }

      if(pedido.vendedor.toString() !== ctx.usuario.id){
        throw new Error('No tienes las credenciales');
      }

      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({ vendedor : ctx.usuario.id, estado: estado} );
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match : { estado : "COMPLETADO" } },
        { $group : {
          _id : "$cliente",
          total : { $sum : '$total' }
        }},
        {
          $lookup : {
            from : 'clientes',
            localField : '_id',
            foreignField : '_id',
            as: 'cliente'
          }
        },
        { 
          $limit : 10,
        },
        {
          $sort : { total : -1 }
        }
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match : { estado : "COMPLETADO" } },
        { $group : {
          _id : "$vendedor",
          total : { $sum : '$total' }
        }},
        {
          $lookup : {
            from : 'usuarios',
            localField : '_id',
            foreignField : '_id',
            as: 'vendedor'
          }
        },
        { 
          $limit : 3,
        },
        {
          $sort : { total : -1 }
        }
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({ $text : { $search : texto}}).limit(10);
      return productos;
    }
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      //Revisar si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      console.log(existeUsuario);
      if (existeUsuario) {
        throw new Error("El usuario ya existe");
      }

      //Hasear el password
      //const salt = await bcryptjs.getSalt(10);
      const salt = await bcryptjs.genSaltSync(10);
      var hash = bcryptjs.hashSync("B4c0//", salt);
      input.password = await bcryptjs.hashSync(password, hash);

      try {
        //Guardarlo en la DB
        const usuario = new Usuario(input);
        usuario.save();
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;
      //Si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      console.log(existeUsuario);
      if (!existeUsuario) {
        throw new Error("El usuario NO existe");
      }

      //Revisar Password
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("Password Incorrecto");
      }
      //Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        //Almacenar
        const resultado = await producto.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      //Revisar que existe
      let producto = await Producto.findById(id);
      console.log(producto)
      if(!producto){
        throw new Error('Producto no encontrado');
      }
      //Si existe entonces actualizarlo

      producto = await Producto.findOneAndUpdate({_id: id }, input, { new:true });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //Revisar que existe
      let producto = await Producto.findById(id);
      if(!producto){
        throw new Error('Producto no encontrado');
      }
      //Si existe entonces eliminarlo
      producto = await Producto.findOneAndDelete({_id: id});
      return "Producto Eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {

      console.log(ctx);
      const { email } = input;

      //Revisar si el cliente  existe
      const existeCliente = await Cliente.findOne({ email });
      console.log(existeCliente);
      if (existeCliente) {
        throw new Error("El cliente ya existe");
      }
      
      //asignar vendedor
      const nuevoCliente = new Cliente(input);
      nuevoCliente.vendedor = ctx.usuario.id;

      try {
        //Guardarlo en la DB
        const resultado = nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //Revisar que existe
      let cliente = await Cliente.findById(id);
      console.log(cliente)
      if(!cliente){
        throw new Error('Cliente no encontrado');
      }
      
      //Verificar si su vendedor edita
      if(cliente.vendedor.toString() !== ctx.usuario.id ){
        throw new Error('No tiene credenciales');
      }
      
      //Si existe entonces actualizarlo
      cliente = await Cliente.findOneAndUpdate({_id: id }, input, { new:true });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      //Revisar que existe
      let cliente = await Cliente.findById(id);
      console.log(cliente)
      if(!cliente){
        throw new Error('Cliente no encontrado');
      }
      //Verificar si su vendedor elimina
      if(cliente.vendedor.toString() !== ctx.usuario.id ){
        throw new Error('No tiene credenciales');
      }

      //Si existe entonces eliminarlo
      cliente = await Cliente.findOneAndDelete({_id: id});
      return "Cliente Eliminado";
    },    
    nuevoPedido: async (_, { input }, ctx) => {

      console.log(ctx);
      const { cliente } = input;
      //Revisar si el cliente  existe
      const existeCliente = await Cliente.findById(cliente);
      console.log(existeCliente);
      if (!existeCliente) {
        throw new Error("El cliente NO existe");
      }
      //Revisar si es su  cliente
      if(existeCliente.vendedor.toString() !== ctx.usuario.id ){
        throw new Error('No tiene credenciales');
      }
      
      //Revisar stock
      for await (const articulo of input.pedido){
        const { id } = articulo;
        const producto = await Producto.findById(id);

        if(articulo.cantidad > producto.existencia){
          throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponoible`)
        } else {
          producto.existencia = producto.existencia - articulo.cantidad;
          try {
            await producto.save();
          } catch (error) {
            console.log(error);
          }
        }
      }

      //Crear nuevo pedido
      const nuevoPedido = new Pedido(input);

      //Asignar vendedor
      nuevoPedido.vendedor = ctx.usuario.id;

      try {
        //Guardarlo en la DB
        const resultado = nuevoPedido.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      //Revisar que existe
      let existePedido = await Pedido.findById(id);
      if(!existePedido){
        throw new Error('Pedido no encontrado');
      }
      let existeCliente = await Cliente.findById(cliente);
      if(!existeCliente){
        throw new Error('Cliente no encontrado');
      }
      //Verificar si su vendedor edita
      if(existeCliente.vendedor.toString() !== ctx.usuario.id ){
        throw new Error('No tiene credenciales');
      }
      
      if ( input.pedido ) {
        //Revisar Stock
        for await (const articulo of input.pedido){
          const { id } = articulo;
          const producto = await Producto.findById(id);
  
          if(articulo.cantidad > producto.existencia){
            throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponoible`)
          } else {
            producto.existencia = producto.existencia - articulo.cantidad;
            try {
              await producto.save();
            } catch (error) {
              console.log(error);
            }
          }
        }
      }
      
      
      const resultado = await Pedido.findOneAndUpdate({_id: id}, input, { new : true});
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      //Revisar que existe
      let pedido = await Pedido.findById(id);
      if(!pedido){
        throw new Error('Pedido no encontrado');
      }
      //Verificar si su vendedor elimina
      if(pedido.vendedor.toString() !== ctx.usuario.id ){
        throw new Error('No tiene credenciales');
      }

      //Si existe entonces eliminarlo
      await Pedido.findOneAndDelete({_id: id});
      return "Cliente Eliminado";
    },    
  },
};

module.exports = resolvers;

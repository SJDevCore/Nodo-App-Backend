import * as Joi from 'joi';

/**
 * Esquema de validación de las variables de entorno.
 *
 * Se ejecuta al arrancar la aplicación: si falta una variable obligatoria
 * o tiene un formato inválido, la app NO arranca y muestra el error.
 * Así evitamos fallos silenciosos en tiempo de ejecución
 * (por ejemplo, descubrir que no hay conexión a Mongo hasta la primera petición).
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  // Acepta tanto Atlas (mongodb+srv://) como una instancia local (mongodb://)
  MONGO_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\//)
    .required()
    .messages({
      'string.pattern.base':
        'MONGO_URI debe empezar por mongodb:// o mongodb+srv://',
      'any.required': 'MONGO_URI es obligatoria',
    }),

  //JWT_SECRET
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
    'any.required': 'JWT_SECRET es obligatoria',
  }),
  //JWT_EXPIRES_IN
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d')
    .messages({
      'string.pattern.base':
        'JWT_EXPIRES_IN debe tener formato como 15m, 12h o 7d',
    }),
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
});

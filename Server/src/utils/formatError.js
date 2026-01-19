import { GraphQLError } from 'graphql';

const formatError = (formattedError, error) => {
  // 1. Mongoose Validasyon Hatalarını Yakala
  // (Örn: Email zorunlu, Unique kullanıcı adı vb.)
  if (error.originalError && error.originalError.name === 'ValidationError') {
    const errors = Object.values(error.originalError.errors).map(err => err.message);
    return {
      message: 'Validasyon Hatası',
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: 'BAD_USER_INPUT',
        details: errors // Frontend'e dizi olarak hataları döner
      }
    };
  }

  // 2. MongoDB Duplicate Key Hatası (Örn: Aynı email ile kayıt olma)
  if (error.originalError && error.originalError.code === 11000) {
    const field = Object.keys(error.originalError.keyValue)[0];
    return {
      message: `Bu ${field} adresi zaten kullanımda.`,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: field
      }
    };
  }

  // 3. JWT Yetkilendirme Hataları
  if (error.message.includes("Giriş yapmalısınız") || error.message.includes("Unauthorized")) {
    return {
      ...formattedError,
      extensions: {
        ...formattedError.extensions,
        code: 'UNAUTHENTICATED',
      }
    };
  }

  // 4. Bizim fırlattığımız özel hatalar (throw new Error(...))
  // Olduğu gibi dönsün, bunlarda sorun yok.
  return formattedError;
};

export default formatError;
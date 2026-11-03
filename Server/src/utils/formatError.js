import { GraphQLError } from 'graphql';

const formatError = (formattedError, error) => {
  const stripDebug = result => {
    const { stacktrace, exception, ...extensions } = result.extensions || {};
    return { ...result, extensions };
  };
  // 1. Mongoose Validasyon Hatalarını Yakala
  // (Örn: Email zorunlu, Unique kullanıcı adı vb.)
  if (error.originalError && error.originalError.name === 'ValidationError') {
    const errors = Object.keys(error.originalError.errors).map(field => `${field}: geçerli bir değer girin.`);
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
    const field = Object.keys(error.originalError.keyValue || {})[0] || 'kayıt';
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
      ...stripDebug(formattedError),
      extensions: {
        ...stripDebug(formattedError).extensions,
        code: 'UNAUTHENTICATED',
      }
    };
  }

  // 4. Bizim fırlattığımız özel hatalar (throw new Error(...))
  // Olduğu gibi dönsün, bunlarda sorun yok.
  if (error.originalError?.name === 'CastError') return { message: 'Geçerli bir kayıt kimliği veya alan değeri girin.', path: formattedError.path, extensions: { code: 'BAD_USER_INPUT' } };
  if (process.env.NODE_ENV === 'production' && (!formattedError.extensions?.code || formattedError.extensions.code === 'INTERNAL_SERVER_ERROR')) return { message: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.', path: formattedError.path, extensions: { code: 'INTERNAL_SERVER_ERROR' } };
  return formattedError.extensions?.stacktrace || formattedError.extensions?.exception ? stripDebug(formattedError) : formattedError;
};

export default formatError;

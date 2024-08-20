import { Constants, getJsonIgnoreDecorator, getJsonPropertyDecorator, getPropertyDecorator } from './ReflectHelper';
import { ErrorCode } from 'vitalink-constants';

/**
 * Decorator names
 */
export const JSON_PROPERTY_DECORATOR_NAME = 'JsonProperty';
// const JSON_IGNORE_DECORATOR_NAME = 'JsonIgnore';

/**
 * Decorator metadata definition for JsonProperty
 */
export interface JsonPropertyDecoratorMetadata {
    name?: string; // name of the JSON property to map
    required?: boolean; // is this field required in the JSON object that is being deserialized
    access?: AccessType; // is this serializable and de-serializable
    type?: any; // the type of Object that should be assigned to this property
    serializer?: any; // Serializer for the type
    deserializer?: any; // deserializer for the type
}

export enum AccessType {
    READ_ONLY, WRITE_ONLY, BOTH
}

export interface Serializer {
    serialize(value: any): any;
}

export interface Deserializer {
    deserialize(value: any): any;
}

/**
 * JsonProperty Decorator function.
 */
export const JsonProperty = (metadata?: JsonPropertyDecoratorMetadata | string): any => {
    if (typeof metadata === 'string') {
        return getJsonPropertyDecorator({ name: metadata as string, required: false, access: AccessType.BOTH });
    } else {
        return getJsonPropertyDecorator(metadata);
    }
};

/**
 * Decorator for specifying cache key.
 * Used for Serializer/Deserializer caching.
 *
 * @export
 * @param {string} key
 * @returns
 */
export const CacheKey = (key: string): Function => {
    return (f: any) => {
        const functionName = 'getJsonObjectMapperCacheKey';
        const functionImpl = new Function(`return '${key}';`);
        f[functionName] = functionImpl;
    };
};

/**
 * JsonIgnore Decorator function.
 */
export const JsonIgnore = (): Function => {
    return getJsonIgnoreDecorator();
};

class ErrorClass extends Error {
    constructor (message: string) {
      super();
  
      if (Error.hasOwnProperty('captureStackTrace'))
          Error.captureStackTrace(this, this.constructor);
      else
         Object.defineProperty(this, 'stack', {
            value: (new Error()).stack
        });
  
      Object.defineProperty(this, 'message', {
        value: message
      });
    }
}

/**
 * Json convertion error type.
 */
export class JsonConversionError extends ErrorClass {
    public errorCode: ErrorCode;
    
    constructor(message: string, errorCode: ErrorCode = ErrorCode.INVALID_JSON) {
        super(message);
        this.name = "JsonConversionError";
        this.errorCode = errorCode;
    }
}

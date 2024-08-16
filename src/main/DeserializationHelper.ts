import { AccessType, Deserializer, JsonConversionError , JsonPropertyDecoratorMetadata} from './DecoratorMetadata';
import { Constants, getCachedType, getJsonPropertyDecoratorMetadata, getTypeName, getTypeNameFromInstance, isArrayType, isSimpleType, METADATA_JSON_IGNORE_NAME, METADATA_JSON_PROPERTIES_NAME } from './ReflectHelper';

declare var Reflect;

const SimpleTypeCoverter = (value: any, type: any): any => {
    if (areCompatibleSimpleTypes(type, value)) {
        return value;
    }
    else if (type === Date) {
        if ((typeof value) != 'number'){
            throw new JsonConversionError(`Invalid Date format: ${value}. Must be the number of ms since 1 January 1970.`)
        }        
        return new Date(value);
    }
    
    throw new JsonConversionError(`Value ${value} is not compatible with type ${type.name}`);
};


function areCompatibleSimpleTypes(type: any, element: any): boolean {
    let elementType: string = typeof element;

    return element instanceof type ||
        Constants.STRING_TYPE_LOWERCASE == elementType && type == String ||
        Constants.NUMBER_TYPE_LOWERCASE == elementType && type == Number ||
        Constants.BOOLEAN_TYPE_LOWERCASE == elementType && type == Boolean ||
        Constants.DATE_TYPE_LOWERCASE == elementType && type == Date
}

/**
 * Deserializes a standard js object type(string, number and boolean) from json.
 */
export const DeserializeSimpleType = (instance: Object, instanceKey: string, type: any, json: any, jsonKey: string) => {

    if (areCompatibleSimpleTypes(type, json[jsonKey])) {
        instance[instanceKey] = json[jsonKey];
        return []
    }
    else {
        throw new JsonConversionError(`Property '${instanceKey}' of ${instance.constructor['name']} does not match datatype of ${jsonKey}`);
    }
};

/**
 * Deserializes a standard js Date object type from json.
 */
export const DeserializeDateType = (instance: Object, instanceKey: string, type: any, json: any, jsonKey: string): Array<ConversionFunctionStructure> => {
    try {
        instance[instanceKey] = new Date(json[jsonKey]);
        return [];
    } catch (e) {
        // tslint:disable-next-line:no-string-literal
        throw new JsonConversionError(`Property '${instanceKey}' of ${instance.constructor['name']} does not match datatype of ${jsonKey}`);
    }
};

function getArrayType(arrayType: string): any {
    const match = arrayType.match(/^Array<(.*)>$/);
    if (match && match[1]) {
        return match[1].trim();
    } else {
        throw new JsonConversionError(`Invalid Array type format: ${arrayType}`);
    }
}

/**
 * Deserializes a JS array type from json.
 */
export let DeserializeArrayType = (instance: any, instanceKey: string, type: any, json: Object, jsonKey: string): Array<ConversionFunctionStructure> => {
    const jsonObject = (jsonKey !== undefined) ? (json[jsonKey] || []) : json;
    const jsonArraySize = jsonObject.length;
    const conversionFunctionsList = [];
    const arrayInstance = [];
    instance[instanceKey] = arrayInstance;
    if (jsonArraySize > 0) {
        for (let i = 0; i < jsonArraySize; i++) {
            if (jsonObject[i] !== undefined) {
                let typeName = type.name;
                if (!isSimpleType(typeName)) {
                    const typeInstance = new type();
                    conversionFunctionsList.push({ functionName: Constants.OBJECT_TYPE, instance: typeInstance, type: type, json: jsonObject[i] });
                    arrayInstance.push(typeInstance);
                } else {
                    arrayInstance.push(conversionFunctions[Constants.FROM_ARRAY](jsonObject[i], type));
                }
            }
        }
    }
    return conversionFunctionsList;
};

/**
 * Deserializes a js object type from json.
 */
export const DeserializeComplexType = (instance: Object, instanceKey: string, type: any, json: any, jsonKey: string): Array<ConversionFunctionStructure> => {
    const conversionFunctionsList = [];

    let objectInstance;
    /**
     * If instanceKey is not passed on then it's the first iteration of the functions.
     */
    // tslint:disable-next-line:triple-equals
    if (instanceKey != undefined) {
        objectInstance = new type();
        instance[instanceKey] = objectInstance;
    } else {
        objectInstance = instance;
    }

    let objectKeys: string[] = Object.keys(objectInstance);

    objectKeys = objectKeys.concat((Reflect.getMetadata(METADATA_JSON_PROPERTIES_NAME, objectInstance) || []).filter((item: string) => {
        if (objectInstance.constructor.prototype.hasOwnProperty(item) && Object.getOwnPropertyDescriptor(objectInstance.constructor.prototype, item).set === undefined) {
            // Property does not have setter
            return false;
        }
        return objectKeys.indexOf(item) < 0;
    }));
    objectKeys = objectKeys.filter((item: string) => {
        return !Reflect.hasMetadata(METADATA_JSON_IGNORE_NAME, objectInstance, item);
    });
    objectKeys.forEach((key: string) => {
        /**
         * Check if there is any DecoratorMetadata attached to this property, otherwise create a new one.
         */
        let metadata: JsonPropertyDecoratorMetadata = getJsonPropertyDecoratorMetadata(objectInstance, key);
        if (metadata === undefined) {
            metadata = { name: key, required: false, access: AccessType.BOTH };
        }
        // tslint:disable-next-line:triple-equals
        if (AccessType.WRITE_ONLY != metadata.access) {
            // tslint:disable-next-line:triple-equals
            const jsonKeyName = metadata.name != undefined ? metadata.name : key;
            /**
             * Check required property
             */
            if (metadata.required && json[jsonKeyName] === undefined) {
                throw new JsonConversionError(`JSON structure does have have required property '${key}' as required by '${getTypeNameFromInstance(objectInstance)}[${key}]`);
            }
            // tslint:disable-next-line:triple-equals
            if (json && json[jsonKeyName] != undefined) {
                /**
                 * If metadata has deserializer, use that one instead.
                 */
                // tslint:disable-next-line:triple-equals
                if (metadata.deserializer != undefined) {
                    objectInstance[key] = getOrCreateDeserializer(metadata.deserializer).deserialize(json[jsonKeyName]);
                } else if (metadata.type === undefined) {
                    /**
                    * If we do not have any type defined, then we can't do much here but to hope for the best.
                    */
                    objectInstance[key] = json[jsonKeyName];
                } else {
                    if (!isArrayType(objectInstance, key)) {
                        // tslint:disable-next-line:triple-equals
                        const typeName = metadata.type != undefined ? getTypeNameFromInstance(metadata.type) : getTypeName(objectInstance, key);
                        if (!isSimpleType(typeName)) {
                            objectInstance[key] = new metadata.type();
                            conversionFunctionsList.push({ functionName: Constants.OBJECT_TYPE, type: metadata.type, instance: objectInstance[key], json: json[jsonKeyName] });
                        } else {
                            conversionFunctions[typeName](objectInstance, key, metadata.type, json, jsonKeyName);
                        }
                    } else {
                        const moreFunctions: Array<ConversionFunctionStructure> = conversionFunctions[Constants.ARRAY_TYPE](objectInstance, key, metadata.type, json, jsonKeyName);
                        moreFunctions.forEach((struct: ConversionFunctionStructure) => {
                            conversionFunctionsList.push(struct);
                        });
                    }
                }
            }
            else if (isSimpleType(typeof json)){
                throw new JsonConversionError(`Attempting to convert a simple type object '${json}' into a '${type.name}'`);
            }
        }

    });

    return conversionFunctionsList;
};

/**
 * Conversion function parameters structure that will be used to call the function.
 */
export interface ConversionFunctionStructure {
    functionName: string;
    instance: any;
    instanceKey?: string;
    type?: any;
    json: any;
    jsonKey?: string;
}

/**
 * Object to cache deserializers
 */
export const deserializers = {};

/**
 * Checks to see if the deserializer already exists or not.
 * If not, creates a new one and caches it, returns the
 * cached instance otherwise.
 */
export const getOrCreateDeserializer = (type: any): any => {
    return getCachedType(type, deserializers);
};

/**
 * List of JSON object conversion functions.
 */
export const conversionFunctions = {};
conversionFunctions[Constants.OBJECT_TYPE] = DeserializeComplexType;
conversionFunctions[Constants.ARRAY_TYPE] = DeserializeArrayType;
conversionFunctions[Constants.DATE_TYPE] = DeserializeDateType;
conversionFunctions[Constants.STRING_TYPE] = DeserializeSimpleType;
conversionFunctions[Constants.NUMBER_TYPE] = DeserializeSimpleType;
conversionFunctions[Constants.BOOLEAN_TYPE] = DeserializeSimpleType;
conversionFunctions[Constants.FROM_ARRAY] = SimpleTypeCoverter;
conversionFunctions[Constants.OBJECT_TYPE_LOWERCASE] = DeserializeComplexType;
conversionFunctions[Constants.ARRAY_TYPE_LOWERCASE] = DeserializeArrayType;
conversionFunctions[Constants.DATE_TYPE_LOWERCASE] = DeserializeDateType;
conversionFunctions[Constants.STRING_TYPE_LOWERCASE] = DeserializeSimpleType;
conversionFunctions[Constants.NUMBER_TYPE_LOWERCASE] = DeserializeSimpleType;
conversionFunctions[Constants.BOOLEAN_TYPE_LOWERCASE] = DeserializeSimpleType;

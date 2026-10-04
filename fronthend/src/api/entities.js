import restClient from './restClient';

const makeEntity = (name) => ({
	list: (...args) => restClient.listEntities(name, ...args),
	get: (id) => restClient.getEntity(name, id),
	create: (data) => restClient.createEntity(name, data),
	update: (id, data) => restClient.updateEntity(name, id, data),
	delete: (id) => restClient.deleteEntity(name, id),
});

export const ProgramType = makeEntity('ProgramType');
export const Pragram = makeEntity('Pragram');
export const LetterTemplate = makeEntity('LetterTemplate');
export const LetterSettings = makeEntity('LetterSettings');
export const AppSettings = makeEntity('AppSettings');
export const Operator = makeEntity('Operator');
export const PoliticianType = makeEntity('PoliticianType');
export const Politician = makeEntity('Politician');
export const Mandal = makeEntity('Mandal');

// auth shim
export const User = {
	me: () => restClient.authMe(),
};
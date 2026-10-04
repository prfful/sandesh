
import restClient from './restClient';

// Lightweight compatibility layer so existing code that imported
// `integrations.Core.UploadFile(...)` can keep using the same call shape.
export const Core = {
	UploadFile: async ({ file }) => {
		const fd = new FormData();
		fd.append('file', file);
		return await restClient.uploadFile(fd);
	},
	// Other helpers exposed as invokeFunction wrappers
	InvokeLLM: async (payload) => restClient.invokeFunction('InvokeLLM', payload),
	SendEmail: async (payload) => restClient.invokeFunction('SendEmail', payload),
	GenerateImage: async (payload) => restClient.invokeFunction('GenerateImage', payload),
	ExtractDataFromUploadedFile: async (payload) => restClient.invokeFunction('ExtractDataFromUploadedFile', payload),
	CreateFileSignedUrl: async (payload) => restClient.invokeFunction('CreateFileSignedUrl', payload),
	UploadPrivateFile: async ({ file }) => {
		const fd = new FormData();
		fd.append('file', file);
		return await restClient.uploadFile(fd);
	}
};







import restClient from './restClient';

export const sendWhatsAppPDF = (payload) => restClient.invokeFunction('sendWhatsAppPDF', payload);

export const convertHtmlToImage = (payload) => restClient.invokeFunction('convertHtmlToImage', payload);

export const generatePdfFromHtml = (payload) => restClient.invokeFunction('generatePdfFromHtml', payload);

export const operatorAuth = (payload) => restClient.invokeFunction('operatorAuth', payload);

export const sendWhatsAppDirect = (payload) => restClient.invokeFunction('sendWhatsAppDirect', payload);
export const sendWhatsAppMessage = (payload) => restClient.invokeFunction('sendWhatsAppMessage', payload);
export const logWhatsAppSend = (payload) => restClient.invokeFunction('logWhatsAppSend', payload);


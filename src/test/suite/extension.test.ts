import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
	OPCUACertificateManager
  } from "node-opcua";



// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	const certificateManager = new OPCUACertificateManager({
		rootFolder: "/Users/tobiaskapser/Desktop/Projekte/vscode-opcua/certificates",
	 });


});

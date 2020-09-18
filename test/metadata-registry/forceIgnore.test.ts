/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ForceIgnore } from '../../src/metadata-registry/forceIgnore';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { FORCE_IGNORE_FILE } from '../../src/utils/constants';
import { join, sep } from 'path';
import { Lifecycle } from '@salesforce/core';

const env = createSandbox();

describe('ForceIgnore', () => {
  const forceIgnorePath = join('some', FORCE_IGNORE_FILE);
  const testPath = join('some', 'path', '__tests__', 'myTest.x');
  const testPattern = '**/__tests__/**';

  afterEach(() => env.restore());

  it('Should default to not ignoring a file if forceignore is not loaded', () => {
    const path = join('some', 'path');
    const forceIgnore = new ForceIgnore();
    expect(forceIgnore.accepts(path)).to.be.true;
    expect(forceIgnore.denies(path)).to.be.false;
  });

  it('Should ignore files with a given pattern', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
    expect(forceIgnore.denies(testPath)).to.be.true;
  });

  it('Should find a forceignore file from a given path', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const searchStub = env.stub(fsUtil, 'searchUp');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    searchStub.withArgs(testPath, FORCE_IGNORE_FILE).returns(forceIgnorePath);
    const forceIgnore = ForceIgnore.findAndCreate(testPath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
  });

  it('should send telemetry event when the old parser and the new parser have different results', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);

    let expected = {
      eventName: 'FORCE_IGNORE_DIFFERENCE',
      content:
        '**/__tests__/**\n**/*.dup\n**/.*\n**/package2-descriptor.json\n**/package2-manifest.json',
      oldLibraryResults: false,
      newLibraryResults: true,
      ignoreLines: [
        '**/__tests__/**',
        '**/*.dup',
        '**/.*',
        '**/package2-descriptor.json',
        '**/package2-manifest.json',
      ],
      file: 'some/path/__tests__/myTest.x',
    };

    if (process.platform === 'win32') {
      expected = {
        content:
          '**\\__tests__\\**\n**\\*.dup\n**\\.*\n**\\package2-descriptor.json\n**\\package2-manifest.json',
        eventName: 'FORCE_IGNORE_DIFFERENCE',
        file: 'some\\path\\__tests__\\myTest.x',
        ignoreLines: [
          '**\\__tests__\\**',
          '**\\*.dup',
          '**\\.*',
          '**\\package2-descriptor.json',
          '**\\package2-manifest.json',
        ],
        newLibraryResults: true,
        oldLibraryResults: false,
      };
    }

    const telemetrySpy = env.spy(Lifecycle.prototype, 'emit');
    // @ts-ignore call the private method directly to avoid excessive stubbing
    forceIgnore.resolveConflict(true, false, testPath);
    expect(telemetrySpy.calledOnce).to.be.true;
    expect(telemetrySpy.args[0][0]).to.equal('telemetry');
    expect(telemetrySpy.args[0][1]).to.deep.equal(expected);
  });

  /**
   * TODO: Rework when approach to default patterns changes. We should be able
   * to generally test the defaults system.
   */
  describe('Defaults', () => {
    let forceIgnore: ForceIgnore;
    const root = join('some', 'path');

    beforeEach(() => {
      env.stub(fs, 'readFileSync').returns('');
      forceIgnore = new ForceIgnore();
    });

    it('Should ignore files starting with a dot', () => {
      const dotPath = join(root, '.xyz');
      expect(forceIgnore.accepts(dotPath)).to.be.false;
      expect(forceIgnore.denies(dotPath)).to.be.true;
    });

    it('Should ignore files ending in .dup', () => {
      const dupPath = join(root, 'abc.dup');
      expect(forceIgnore.accepts(dupPath)).to.be.false;
      expect(forceIgnore.denies(dupPath)).to.be.true;
    });

    it('Should ignore files named package2-descriptor.json', () => {
      const descriptorPath = join(root, 'package2-descriptor.json');
      expect(forceIgnore.accepts(descriptorPath)).to.be.false;
      expect(forceIgnore.denies(descriptorPath)).to.be.true;
    });

    it('Should ignore files named package2-manifest.json', () => {
      const manifestPath = join(root, 'package2-manifest.json');
      expect(forceIgnore.accepts(manifestPath)).to.be.false;
      expect(forceIgnore.denies(manifestPath)).to.be.true;
    });
  });
});

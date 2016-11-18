describe('main', () => {
  const chai = require('chai');
  const expect = chai.expect;
  const sinon = require('sinon');
  const sinonChai = require("sinon-chai");
  chai.use(sinonChai);

  const proxyquire =  require('proxyquire');

  const EXIT_1_ERROR = new Error('exit 1');

  const getVersionFromPackageMock = sinon.stub();
  const getRepoFullnameFromPackageMock = sinon.stub();
  const getPublishReleaseFunctionMock = sinon.stub();
  const publishReleaseMock = sinon.stub();
  publishReleaseMock.returns(Promise.resolve({}));
  getPublishReleaseFunctionMock.returns(publishReleaseMock);
  const parseChangelogMock = sinon.stub();

  const shellStub = {
    exit: sinon.stub(),
    cat: sinon.stub(),
  };

  shellStub.exit.withArgs(1).throws(EXIT_1_ERROR);

  const CHANGELOG_FILE_NAME = 'CHANGELOG.md';
  const CHANGELOG_FILE_OUT = 'default changelog stdout';
  const VERSION = '0.0.1';
  const REPO_FULLNAME = 'foo/bar';
  const GITHUB_TOKEN = 'github-token-123';

  function aChangeLogItem(version = VERSION, releaseTitle = 'Release title', releaseDescription) {
    return { version, releaseTitle, releaseDescription };
  }

  beforeEach(() => {
    process.env.GITHUB_TOKEN = GITHUB_TOKEN;
    getRepoFullnameFromPackageMock.returns(REPO_FULLNAME);
    getVersionFromPackageMock.returns(VERSION);
  });

  afterEach(() => {
    shellStub.cat.reset();
    shellStub.exit.reset();
    publishReleaseMock.reset();
  });

  it('should exit if no GITHUB_TOKEN in env', () => {
    delete process.env.GITHUB_TOKEN;
    try {
      const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
      publishReleaseWithChangelog();
    } catch (e) {
      expect(shellStub.exit).to.have.been.calledWith(1);
    }
  });

  it('should exit if no repo fullname', () => {
    getRepoFullnameFromPackageMock.returns(undefined);
    try {
      const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
      publishReleaseWithChangelog();
    } catch (e) {
      expect(shellStub.exit).to.have.been.calledWith(1);
    }
  });

  it('should exit if bad repo fullname', () => {
    getRepoFullnameFromPackageMock.returns('eeee');
    try {
      const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
      publishReleaseWithChangelog();
    } catch (e) {
      expect(shellStub.exit).to.have.been.calledWith(1);
    }
  });

  it('should cat the CHANGELOG.md file to the parser', () => {
    parseChangelogMock.returns([aChangeLogItem(VERSION)]);
    shellStub.cat.withArgs(CHANGELOG_FILE_NAME).returns('lala');
    const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
    publishReleaseWithChangelog();

    const catCall = shellStub.cat.getCall(0);
    expect(catCall.args[0]).to.equal('CHANGELOG.md');
    const parserCall = parseChangelogMock.getCall(0);
    expect(parserCall.args[0]).to.equal('lala');
  });

  it('should exit if versions from package and last changelog item differ', () => {
    parseChangelogMock.returns([aChangeLogItem(VERSION)]);
    shellStub.cat.returns(CHANGELOG_FILE_OUT);
    getVersionFromPackageMock.returns('0.0.2');
    parseChangelogMock.returns([aChangeLogItem('0.0.3')]);

    try {
      const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
      publishReleaseWithChangelog();
    } catch (e) {
      expect(shellStub.exit).to.have.been.calledWith(1);
    }
  });

  it('should publish release with tag name as version prefixed by "v" with title', () => {
    parseChangelogMock.returns([aChangeLogItem(VERSION)]);
    shellStub.cat.returns(CHANGELOG_FILE_OUT);
    getVersionFromPackageMock.returns(VERSION);
    parseChangelogMock.returns([
      aChangeLogItem(VERSION, 'title'),
      aChangeLogItem('0.0.3'),
    ]);

    const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
    publishReleaseWithChangelog();

    expect(publishReleaseMock).to.have.been.calledWith(`v${VERSION}`, 'title');
  });

  it('should publish release with title and description if present in last changelog item', () => {
    getVersionFromPackageMock.returns(VERSION);
    shellStub.cat.returns(CHANGELOG_FILE_OUT);
    parseChangelogMock.returns([
      aChangeLogItem(VERSION, 'title', 'description lala'),
      aChangeLogItem('0.0.3'),
    ]);

    const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
    publishReleaseWithChangelog();

    expect(publishReleaseMock)
      .to.have.been.calledWith(`v${VERSION}`, 'title', 'description lala');
  });

  it('should exit with 1 if publish fails', () => {
    getVersionFromPackageMock.returns(VERSION);
    shellStub.cat.returns(CHANGELOG_FILE_OUT);
    parseChangelogMock.returns([
      aChangeLogItem(VERSION, 'title', 'description lala'),
      aChangeLogItem('0.0.3'),
    ]);
    publishReleaseMock.returns(Promise.reject('errorrrrr'));

    const publishReleaseWithChangelog = requirePublishReleaseWithChangelog();
    return publishReleaseWithChangelog().catch(err => {
      expect(err).to.equal(EXIT_1_ERROR);
      expect(shellStub.exit).to.have.been.calledWith(1);
    });
  });

  function requirePublishReleaseWithChangelog() {
    return proxyquire('.', {
      shelljs: shellStub,
      '../utils': {
        getVersionFromPackage: getVersionFromPackageMock,
        getRepoFullnameFromPackage: getRepoFullnameFromPackageMock,
      },
      '../publish-github-release': {
        getPublishReleaseFunction: getPublishReleaseFunctionMock,
      },
      '../parser': {
        parseChangelog: parseChangelogMock,
      },
    });
  }
});
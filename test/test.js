var assert = require('assert');
var fs = require('fs-extra');
var Tree = require('./utils/builder');
var watch = require('../');

var tree = Tree();
var watcher;

beforeEach(function(done) {
  tree = Tree();
  if (watcher) watcher.close();
  setTimeout(done, 500);
});

after(function() {
  tree && tree.cleanup()
});


describe('watch for files', function() {

  it('should watch a single file and keep watching', function(done) {
    var times = 1;
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function(evt, name) {
      assert.equal(fpath, name)
      if (times++ >= 3) {
        done();
      }
    });
    tree.modify(file);
    tree.modify(file, 300);
    tree.modify(file, 600);
  });

  it('should watch files inside a folder', function(done) {
    var dir = 'home/a';
    var fpath = tree.getPath('home/a');
    var stack = [
      tree.getPath('home/a/file1'),
      tree.getPath('home/a/file2')
    ];

    watcher = watch(fpath, function(evt, name) {
      stack.splice(stack.indexOf(name), 1);
      if (!stack.length) done();
    });

    tree.modify('home/a/file1')
    tree.modify('home/a/file2')
  });

  it('should watch recursively with `recursive: true` option', function(done) {
    var dir = tree.getPath('home');
    var file = tree.getPath('home/a/file1');
    watcher = watch(dir, { recursive: true }, function(evt, name) {
      assert.equal(file, name);
      done();
    });
    setTimeout(function() {
      tree.modify('home/a/file1');
    }, 200);
  });

  it('should ignore duplicate changes', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    var times = 0;
    watcher = watch(fpath, function(evt, name) {
      if (fpath == name) times++;
      setTimeout(function() {
        assert(times == 1)
        done();
      }, 200);
    });
    tree.modify(file);
    tree.modify(file);
    tree.modify(file);
  });

});


describe('watch for directoies', function() {

  it('should watch directories inside a directory', function(done) {
    var home = tree.getPath('home');
    var dir = tree.getPath('home/c');

    watcher = watch(home, { recursive: true }, function(evt, name) {
      assert.equal(dir, name)
      done();
    });

    tree.remove('home/c', 300);
  });

  it('should watch new created directories', function(done) {
    var home = tree.getPath('home');
    watcher = watch(home, { recursive: true }, function(evt, name) {
      if (name == tree.getPath('home/new/file1')) {
        done();
      }
    });

    tree.newFile('home/new/file1');
    tree.modify('home/new/file1', 500);
  });
});


describe('events', function() {
  it('should identify `remove` event', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function(evt, name) {
      if (evt == 'remove' && name == fpath) done();
    });
    tree.remove(file, 100);
  });

  it('should identify `update` event', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function(evt, name) {
      if (evt == 'update' && name == fpath) done();
    });
    tree.modify(file, 100);
  });

  it('should report `update` on create new files', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/newfile' + Date.now();
    var fpath = tree.getPath(file);
    watcher = watch(dir, function(evt, name) {
      if (evt == 'update' && name == fpath) done();
    });
    tree.newFile(file);
  });

});


describe('options', function() {
  describe('filter', function() {
    it('should only watch filtered directories', function(done) {
      var shouldModify = true;
      var shouldNotModify = false;

      var option = {
        recursive: true,
        filter: function(name) {
          return !/node_modules/.test(name);
        }
      };

      watcher = watch(tree.getPath('home'), option, function(name) {
        if (/node_modules/.test(name)) {
          shouldNotModify = true;
        } else {
          shouldModify = false;
        }
      });

      setTimeout(function() {
        tree.modify('home/a/file1');
        tree.modify('home/node_modules/ma/file1');
      }, 200);

      setTimeout(function() {
        assert(!shouldModify, 'watch failed');
        assert(!shouldNotModify, 'fail to ingore path `node_modules`');
        done();
      }, 500);
    });

    it('should only report filtered files', function(done) {
      var dir = tree.getPath('home/a');
      var file1 = 'home/a/file1'
      var file2 = 'home/a/file2'

      var options = {
        filter: function(name) {
          return !/file1/.test(name);
        }
      }

      var times = 0;
      watcher = watch(dir, options, function(evt, name) {
        times++;
        if (name == tree.getPath(file2)) {
          assert(times, 1, 'home/a/file1 should be ignored.');
          done();
        }
      });

      tree.modify(file1);
      tree.modify(file2, 200);
    });

  });
});


describe('parameters', function() {

  it('should throw error on non-existed file', function(done) {
    var somedir = tree.getPath('home/somedir');
    try {
      watcher = watch(somedir);
    } catch(err) {
      done();
    }
  });

  it('should compose array of files or directories', function(done) {
    var file1 = 'home/a/file1';
    var file2 = 'home/a/file2';
    var fpaths = [
      tree.getPath(file1),
      tree.getPath(file2)
    ];

    times = 0;
    watcher = watch(fpaths, function(evt, name) {
      if (fpaths.indexOf(name) !== -1) times++;
      if (times >= 2) done();
    });

    tree.modify(file1);
    tree.modify(file2);
  });

});


describe('watcher object', function() {

  it('should using watcher object to watch', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);

    watcher = watch(dir);
    watcher.on('change', function(evt, name) {
      assert(evt == 'update');
      assert(name == fpath);
      done();
    });

    tree.modify(file);
  });

  it('should close the watcher using .close()', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/file1';
    var times = 0;
    watcher = watch(dir);
    watcher.on('change', function(evt, name) {
      times++;
    });
    watcher.close();

    tree.modify(file);
    tree.modify(file, 300);
    setTimeout(function() {
      assert(watcher.isClosed() === true)
      assert(times === 0)
      done();
    }, 400);
  });

});

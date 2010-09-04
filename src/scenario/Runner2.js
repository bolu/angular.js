// Setup namespace, but preserve previous state.
angular['scenario'] = angular['scenario'] || (angular['scenario'] = {});
angular.scenario['dsl'] = angular.scenario['dsl'] || (angular.scenario['dsl'] = {});

/**
 * Runner for all Specs
 *
 * env: in production will point to window so that it can publish global methods
 *
 * Responsibilities:
 *   - execute individual Specs
 */
angular.scenario.ScenarioRunner = function(env, logger, iframe){
  var self = this;
  var rootDescribe = new angular.scenario.Describe();
  var currentDescribe = rootDescribe;

  env.xit = angular.noop;
  env.xdescribe = angular.noop;
  env.describe = function(name, body){
    currentDescribe.describe(name, function(){
      var parentDescribe = currentDescribe;
      currentDescribe = this;
      try {
        body.call(this);
      } finally {
        currentDescribe = parentDescribe;
      }
    });
  };
  env.it = function(name, body){ currentDescribe.it(name, body); };
  env.beforeEach = function(body) {currentDescribe.beforeEach(body); };
  env.afterEach = function(body) {currentDescribe.afterEach(body); };

  self.run = run;

  // METHODS
  function run(specsDone) {
    var specs = [];
    rootDescribe.collectSpecSetup(specs);
    asyncForeach(specs, function(specDone, spec){
      var specRunner = new angular.scenario.SpecRunner(spec.name, spec.fn, iframe);
      specRunner.run(logger, specRunner);
    }, specsDone);
  }
};

/**
 * This class is the "this" of the it/beforeEach/afterEach method.
 * Responsibilities:
 *   - "this" for it/beforeEach/afterEach
 *   - keep state for single it/beforeEach/afterEach execution
 *   - keep track of all of the futures to execute
 *   - run single spec (execute each future)
 */
angular.scenario.SpecRunner = function(name, setupFn, iframe){
  var self = this;
  var futures = [];
  var futureSelf = {};
  self.setUp = function(){
    setupFn.call(this);
  };
  self.run = function(logger, specDone){
    var specLogger = logger.child('spec', name);
    asyncForeach(futures, function(futureDone, future){
      var stepLogger = specLogger.child('future', future.name);
      try {
        future.fn.call(futureSelf, function(error){
          if (error) stepLogger.fail(error);
          futureDone();
        });
      } catch (e) {
        stepLogger.fail(e);
      } finally {
        stepLogger.close();
      }
    }, function(){
      specLogger.close();
      specDone();
    });
  };
  self.addFuture = function(name, fn) {
    futures.push({name:name, fn:fn});
  };
};

/**
 * Use this class to create Spec DSL
 * Responsibilities:
 *   - Proved DSL
 *   - Build up the Describe/It data structure
 *   - Build up Spec set-up method list
 */
angular.scenario.Describe = function(descName, parentDesc){
  var self = this;
  var beforeEachFns = [];
  var its = [];
  var afterEachFns = [];
  var childDescribes = [];
  self.name = descName;
  if (parentDesc) {
    if (parentDesc.name)
      self.name = parentDesc.name + ' ' + self.name;
  }

  // METHODS
  self.describe   = function(name, body){
    var childDescribe = new angular.scenario.Describe(name, self);
    childDescribes.push(childDescribe);
    body.call(childDescribe);
  };
  self.beforeEach = function(body){beforeEachFns.push(body);};
  self.afterEach  = function(body){afterEachFns.push(body);};
  self.it         = function(name, body){its.push({name:name, fn:body});};
  self.xit        = angular.noop;
  self.xdescribe  = angular.noop;

  self.setupBefore = function(){
    if (parentDesc) parentDesc.setupBefore.call(this);
    angular.foreach(beforeEachFns, executeFn, this);
  };
  self.setupAfter  = function(){
    angular.foreach(afterEachFns, executeFn, this);
    if (parentDesc) parentDesc.setupAfter.call(this);
  };

  self.collectSpecSetup = function(specSetupFns){
    angular.foreach(its, function(it){
      specSetupFns.push({name: self.name + ': it ' + it.name, fn:function(){
        self.setupBefore.call(this);
        it.fn.call(this);
        self.setupAfter.call(this);
      }});
    });
    angular.foreach(childDescribes, function(childDescribe){
      childDescribe.collectSpecSetup(specSetupFns);
    });
  };
};

/**
 * Logger
 * Responsibilities:
 *   - manipulate the console DOM
 */
angular.scenario.Logger = function(li){
  this.close = close;
  this.fail = fail;
  this.child = child;
  this.element = li;

  var ul;

  function child(type, text){
    if (!ul) {
      ul = new li.init('<ul></ul>');
      li.append(ul);
    }
    var childLi = new ul.init('<li><span></span></li>');
    childLi.find("span").text(text);
    childLi.addClass(type);
    childLi.addClass('running');
    ul.append(childLi);
    return new angular.scenario.Logger(childLi);
  }
  function close(){
    li.removeClass('running');
    li.addClass('done');
  }
  function fail(error){
    li.addClass('fail');
    var failure = child('error', typeof error != 'string' && error ? angular.toJson(error) : error);
    failure.close();
  }
};

///////////////////
/*
 * MISC Functions
 */
function executeFn(fn) { return fn.call(this); }
function asyncForeach(list, iterator, done) {
  var i = 0;
  function loop() {
    if (i < list.length) {
      iterator(loop, list[i++]);
    } else {
      done();
    }
  }
  loop();
}


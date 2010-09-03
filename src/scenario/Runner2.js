
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

function executeFn(fn) {
  return fn.call(this);
}


angular.scenario.Describe = function(descName, describeFn, parentDesc){
  var self = this;
  var beforeEachFns = [];
  var its = [];
  var afterEachFns = [];
  var childDescribes = [];
  self.name = descName;
  if (parentDesc) {
    parentDesc.addChildDescribe(self);
    self.descName = parentDesc.name + ' ' + self.name;
  }
  
  // METHODS
  self.addChildDescribe = function(desc){
    childDescribes.push(desc);
  };
  self.describe   = function(name, body){describeFns.push({name:name, fn:body});};
  self.beforeEach = function(body){beforeEachFns.push(body);};
  self.afterEach  = function(body){afterEachFns.push(body);};
  self.it         = function(name, body){its.push({name:name, fn:body});};
  
  self.setupBefore = function(){
    if (parentDesc) parentDesc.setupBefore.call(this);
    angular.foreach(beforeEachFns, executeFn, this);
  };
  self.setupAfter  = function(){
    angular.foreach(afterEachFns, executefn, this);
    if (parentDesc) parentDesc.setupAfter.call(this);
  };
  
  self.collectSpecSetup = function(specSetupFns){
    angular.foreach(its, function(it){
      specSetupFns.push({name: self.name + ' it ' + it.name, fn:function(){
        self.setupBefore.call(this);
        it.fn.call(this);
        self.setupAfter.call(this);
      }});
    });
    angular.foreach(childDescribes, function(childDescrbe){
      childDescrbe.collectSpecSetup(specSetupFns);
    });
  };
};

angular.scenario.ScenarioRunner = function(){
  
};

angular.scenario.SpecRunner = function(setupFn){
  var self = this;
  var futures = [];
  self.setup = function(){
    setupFn.call(this);
  };
  self.run = function(loggerFactory, done){
    var futureSelf = this;
    asyncForeach(futures, function(future){
      var logger = loggerFactory(future.name);
      try {
        future.fn.call(futureSelf, done);
        logger.succeed();
      } catch (e) {
        logger.fail(e);
      }
    }, done);
  };
  self.addFuture = function(name, fn) {
    futures.push({name:name, fn:fn});
  };
};


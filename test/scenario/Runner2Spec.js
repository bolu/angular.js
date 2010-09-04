function MockLogger(type, name) {
  var self = this;
  self.type = type;
  self.name = name;
  self.child = child;
  self.close = close;
  self.fail = fail;

  function close(){ self.closed = true; }
  function fail(error) { self.failed = error || true;};
  function child(type, name) {
    var children = self.children || [];
    var child = new MockLogger(type, name);
    children.push(child);
    self.children = children;
    return child;
  }
}

describe('scenario', function(){
  var log;
  var root;
  var logger;

  beforeEach(function(){
    root = new angular.scenario.Describe();
    log = function(text){ log.text = log.text + text; };
    log.fn = function(text) {
      return function(done){ log(text); (done||angular.noop)(); };
    };
    log.reset = function(){ log.text = ''; };
    log.reset();

    logger = new MockLogger();
  });

  describe('Describe', function(){
    it('should handle basic nested case', function(){
      root.describe('A', function(){
        this.beforeEach(log.fn('{'));
        this.afterEach(log.fn('}'));
        this.it('1', log.fn('1'));
        this.describe('B', function(){
          this.beforeEach(log.fn('('));
          this.afterEach(log.fn(')'));
          this.it('2', log.fn('2'));
        });
      });
      var specs = [];
      root.collectSpecSetup(specs);
      expect(specs.length).toEqual(2);

      expect(specs[0].name).toEqual('A: it 1');
      specs[0].fn();
      expect(log.text).toEqual('{1}');

      log.reset();
      expect(specs[1].name).toEqual('A B: it 2');
      specs[1].fn();
      expect(log.text).toEqual('{(2)}');
    });
  });

  describe('SpecRunner', function(){
    it('should execute single spec', function(){
      root.describe('A', function(){
        this.beforeEach(function(){
          log('{');
          this.addFuture('fb', log.fn('('));
        });
        this.afterEach(function(){
          this.addFuture('fa', log.fn(')'));
          log('}');
        });
        this.it('1', function(){
          log('+');
          this.addFuture('f1', function(done){
            log('!');
            done('MyReason');
          });
        });
        this.it('2', function(){
          log('X');
          this.addFuture('f2', log.fn('X'));
        });
      });
      var specs = [];
      root.collectSpecSetup(specs);
      var specRunner = new angular.scenario.SpecRunner('Spec', specs[0].fn);
      specRunner.setUp();
      expect(log.text).toEqual('{+}');
      log.reset();
      specRunner.run(logger, log.fn(';'));
      expect(log.text).toEqual('(!);');
      expect(logger.children).toEqualData([{
        type:"spec",
        name:"Spec",
        children:[
          {type:'future', name:"fb", closed:true},
          {type:'future', name:"f1", closed:true, failed: 'MyReason'},
          {type:'future', name:"fa", closed:true}],
        closed:true}]);
    });
  });

  describe('Logger', function(){
    var console,
        logger;
    beforeEach(function(){
      console=_jQuery('<ul></ul>');
      logger = new angular.scenario.Logger(console);
    });

    it('should write text, add children and mark classes', function(){
      var spec = logger.child('spec', 'MySpec');
      expect(spec.element.find('span').text()).toEqual('MySpec');
      expect(spec.element).toHaveClass('running');
      expect(spec.element).toHaveClass('spec');
      expect(spec.element).not.toHaveClass('fail');

      var future = spec.child('future', 'MyStep');
      expect(future.element.find('span').text()).toEqual('MyStep');
      expect(future.element).toHaveClass('running');
      expect(future.element).toHaveClass('future');
      expect(future.element).not.toHaveClass('fail');
      future.fail('MyError');
      expect(future.element).toHaveClass('fail');
      expect(future.element.find('.error').text()).toEqual('MyError');
      expect(future.element.find('.error')).not.toHaveClass('running');

      future.close();
      expect(future.element).not.toHaveClass('running');
    });
  });
});
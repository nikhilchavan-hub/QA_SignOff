// Authentication Controller
angular.module('qaSignOffApp')
.controller('AuthController', ['$state', 'ApiService', function($state, ApiService) {
  var vm = this;
  vm.showSignup = false;
  vm.loginData = {};
  vm.signupData = {};
  vm.loading = false;

  vm.login = function() {
    if (!vm.loginData.email || !vm.loginData.password) {
      alert('Please fill all fields');
      return;
    }
    
    vm.loading = true;
    ApiService.login({
      email: vm.loginData.email,
      password: vm.loginData.password
    }).then(function(response) {
      localStorage.setItem('qa_token', response.data.token);
      localStorage.setItem('qa_user', JSON.stringify(response.data.user));
      vm.loading = false;
      $state.go('dashboard');
    }).catch(function(err) {
      vm.loading = false;
      alert('Login failed: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.signup = function() {
    if (!vm.signupData.firstname || !vm.signupData.lastname || 
        !vm.signupData.email || !vm.signupData.password) {
      alert('Please fill all fields');
      return;
    }
    
    if (vm.signupData.password !== vm.signupData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    vm.loading = true;
    ApiService.signup({
      firstname: vm.signupData.firstname,
      lastname: vm.signupData.lastname,
      email: vm.signupData.email,
      password: vm.signupData.password
    }).then(function(response) {
      vm.loading = false;
      alert('Signup successful! Please login.');
      vm.showSignup = false;
      vm.signupData = {};
    }).catch(function(err) {
      vm.loading = false;
      alert('Signup failed: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };
}]);

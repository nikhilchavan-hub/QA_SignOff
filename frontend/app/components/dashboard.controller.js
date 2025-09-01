// Dashboard Controller
angular.module('qaSignOffApp')
.controller('DashboardController', ['$state', 'ApiService', function($state, ApiService) {
  var vm = this;
  vm.records = [];
  vm.searchText = '';
  vm.page = 1;
  vm.totalPages = 1;
  vm.currentUser = JSON.parse(localStorage.getItem('qa_user') || '{}');
  
  vm.columns = [
    { key: 'project_name', label: 'Project Name' },
    { key: 'application', label: 'Application' },
    { key: 'qa', label: 'QA' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created Date' }
  ];

  vm.loadData = function() {
    var params = {
      page: vm.page,
      limit: 10,
      search: vm.searchText
    };
    
    ApiService.getSignOffDetails(params).then(function(response) {
      vm.records = response.data;
    }).catch(function(err) {
      console.error('Error loading data:', err);
      if (err.status === 401) {
        $state.go('login');
      }
    });
  };

  vm.view = function(row) {
    $state.go('signoff-view', { id: row.id || row.ID });
  };

  vm.edit = function(row) {
    $state.go('signoff-edit', { id: row.id || row.ID });
  };

  vm.goToNewSignOff = function() {
    $state.go('signoff-new');
  };

  vm.goToKnowledgeShare = function() {
    $state.go('knowledge-share');
  };

  vm.search = function() {
    vm.page = 1;
    vm.loadData();
  };

  vm.logout = function() {
    localStorage.removeItem('qa_token');
    localStorage.removeItem('qa_user');
    $state.go('login');
  };

  // Check if user is logged in
  if (!localStorage.getItem('qa_token')) {
    $state.go('login');
    return;
  }

  // Load initial data
  vm.loadData();
}]);

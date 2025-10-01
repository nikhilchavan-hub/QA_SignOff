// Dashboard Controller
angular.module('qaSignOffApp')
.controller('DashboardController', ['$state', 'ApiService', function($state, ApiService) {
  var vm = this;
  vm.records = [];
  vm.paginatedRecords = [];
  vm.searchText = '';
  vm.loading = false;
  vm.currentUser = JSON.parse(localStorage.getItem('qa_user') || '{}');
  
  // Pagination properties
  vm.currentPage = 1;
  vm.itemsPerPage = 10;
  vm.totalPages = 1;
  
  vm.columns = [
    { key: 'project_name', label: 'Project Name' },
    { key: 'application', label: 'Application' },
    { key: 'qa', label: 'QA' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created Date' }
  ];

  vm.loadData = function() {
    vm.loading = true;
    var params = {
      search: vm.searchText
    };
    
    ApiService.getSignOffDetails(params).then(function(response) {
      // Handle the response and extract records
      if (response.data && response.data.data) {
        vm.records = response.data.data;
      } else {
        // Fallback for simplified response format
        vm.records = response.data || [];
      }
      
      vm.updatePagination();
      vm.loading = false;
    }).catch(function(err) {
      console.error('Error loading data:', err);
      vm.loading = false;
      vm.records = [];
      vm.paginatedRecords = [];
      if (err.status === 401) {
        $state.go('login');
      }
    });
  };

  // Pagination functions
  vm.updatePagination = function() {
    vm.totalPages = vm.records.length > 0 ? Math.ceil(vm.records.length / vm.itemsPerPage) : 1;
    if (vm.currentPage > vm.totalPages || vm.currentPage < 1) {
      vm.currentPage = Math.max(1, Math.min(vm.totalPages, vm.currentPage));
    }
    vm.updatePaginatedRecords();
  };

  vm.updatePaginatedRecords = function() {
    var startIndex = (vm.currentPage - 1) * vm.itemsPerPage;
    var endIndex = startIndex + vm.itemsPerPage;
    vm.paginatedRecords = vm.records.slice(startIndex, endIndex);
    console.log('Dashboard pagination updated:', {
      currentPage: vm.currentPage,
      totalPages: vm.totalPages,
      totalRecords: vm.records.length,
      paginatedRecords: vm.paginatedRecords.length,
      startIndex: startIndex,
      endIndex: endIndex
    });
  };

  vm.goToPage = function(page) {
    if (page >= 1 && page <= vm.totalPages && page !== vm.currentPage) {
      vm.currentPage = page;
      vm.updatePaginatedRecords();
    }
  };

  vm.previousPage = function() {
    if (vm.currentPage > 1) {
      vm.currentPage--;
      vm.updatePaginatedRecords();
    }
  };

  vm.nextPage = function() {
    if (vm.currentPage < vm.totalPages) {
      vm.currentPage++;
      vm.updatePaginatedRecords();
    }
  };

  vm.getPageNumbers = function() {
    var pages = [];
    var maxPagesToShow = 5;
    var startPage = Math.max(1, vm.currentPage - Math.floor(maxPagesToShow / 2));
    var endPage = Math.min(vm.totalPages, startPage + maxPagesToShow - 1);
    
    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (var i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // ...existing code...

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
    vm.currentPage = 1;
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

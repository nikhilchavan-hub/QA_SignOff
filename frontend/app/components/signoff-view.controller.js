// Sign Off View Controller
angular.module('qaSignOffApp')
.controller('SignOffViewController', ['$state', '$stateParams', 'ApiService', function($state, $stateParams, ApiService) {
  var vm = this;
  vm.signOffData = null;
  vm.testCases = [];
  vm.defects = [];
  vm.vdsName = '';
  vm.loading = true;
  
  vm.init = function() {
    var signOffId = $stateParams.id;
    
    if (!signOffId) {
      alert('Invalid sign-off ID');
      vm.goBack();
      return;
    }
    
    // Load sign-off details
    ApiService.getSignOffById(signOffId).then(function(response) {
      vm.signOffData = response.data.signoff;
      vm.testCases = response.data.testcases;
      vm.defects = response.data.defects;
      vm.loading = false;
      
      // Load VDS name if VDS_id exists
      if (vm.signOffData && vm.signOffData.vds_id) {
        vm.loadVDSName(vm.signOffData.vds_id);
      }
    }).catch(function(err) {
      vm.loading = false;
      console.error('Error loading sign-off details:', err);
      alert('Error loading sign-off details: ' + (err.data && err.data.error || 'Unknown error'));
      vm.goBack();
    });
  };
  
  vm.loadVDSName = function(vdsId) {
    ApiService.getVDS().then(function(response) {
      var vds = response.data.find(function(v) {
        return v.vds_id === vdsId || v.VDS_ID === vdsId;
      });
      if (vds) {
        vm.vdsName = vds.vds_name || vds.VDS_Name;
      }
    }).catch(function(err) {
      console.error('Error loading VDS data:', err);
    });
  };
  
  vm.goBack = function() {
    $state.go('dashboard');
  };
  
  // RAG Status Styling
  vm.getRagStatusStyle = function() {
    if (!vm.signOffData || !vm.signOffData.rag_status) return {};
    
    switch(vm.signOffData.rag_status) {
      case 'RED':
        return { 'background-color': '#dc3545', 'color': 'white' };
      case 'AMBER':
        return { 'background-color': '#ffc107', 'color': '#212529' };
      case 'GREEN':
        return { 'background-color': '#28a745', 'color': 'white' };
      default:
        return {};
    }
  };
  
  // Status Badge Class
  vm.getStatusClass = function() {
    if (!vm.signOffData || !vm.signOffData.status) return 'secondary';
    
    switch(vm.signOffData.status.toLowerCase()) {
      case 'complete':
        return 'success';
      case 'in progress':
        return 'warning';
      case 'pending':
        return 'info';
      case 'rejected':
        return 'danger';
      default:
        return 'secondary';
    }
  };
  
  // Check if user is logged in
  if (!localStorage.getItem('qa_token')) {
    $state.go('login');
    return;
  }
  
  // Initialize the controller
  vm.init();
}]);

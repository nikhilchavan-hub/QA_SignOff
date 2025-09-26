// Sign Off Form Controller
angular.module('qaSignOffApp')
.controller('SignOffController', ['$state', '$stateParams', 'ApiService', function($state, $stateParams, ApiService) {
  var vm = this;
  vm.form = {
    testCases: {
      passed: { riast: 0, riasp: 0 },
      failed: { riast: 0, riasp: 0 },
      unexecuted: { riast: 0, riasp: 0 }
    },
    defects: {
      enhancements: { resolved: 0, deferred: 0 },
      defects: { resolved: 0, deferred: 0 }
    }
  };
  vm.vdsList = [];
  vm.loading = false;
  vm.isEditMode = $state.current.name === 'signoff-edit';
  vm.signOffId = $stateParams.id;
  vm.currentUser = JSON.parse(localStorage.getItem('qa_user') || '{}');

  // Helper function to format dates properly
  vm.formatDateForSending = function(dateValue) {
    if (!dateValue || dateValue.length === 0 || dateValue === '') {
      return null;
    }
    
    // If it's already in YYYY-MM-DD format and valid, return as is
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      var testDate = new Date(dateValue + 'T00:00:00');
      if (!isNaN(testDate.getTime())) {
        return dateValue;
      }
    }
    
    // Try to parse as Date and format
    var date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  };

  vm.init = function() {
    // Load VDS list
    ApiService.getVDS().then(function(response) {
      vm.vdsList = response.data;
    }).catch(function(err) {
      console.error('Error loading VDS:', err);
    });

    // If in edit mode, load existing sign-off data
    if (vm.isEditMode && vm.signOffId) {
      vm.loadSignOffData();
    }
  };

  vm.loadSignOffData = function() {
    vm.loading = true;
    ApiService.getSignOffById(vm.signOffId).then(function(response) {
      var data = response.data;
      
      // Map the signoff data to form
      if (data.signoff) {
        var signoff = data.signoff;
        
        // Basic fields
        vm.form.project_name = signoff.project_name;
        vm.form.VDS_id = signoff.vds_id;
        vm.form.application = signoff.application;
        vm.form.qa = signoff.qa;
        vm.form.start_date = signoff.start_date ? new Date(signoff.start_date).toISOString().split('T')[0] : null;
        vm.form.end_date = signoff.end_date ? new Date(signoff.end_date).toISOString().split('T')[0] : null;
        vm.form.actual_start_date = signoff.actual_start_date ? new Date(signoff.actual_start_date).toISOString().split('T')[0] : null;
        vm.form.actual_end_date = signoff.actual_end_date ? new Date(signoff.actual_end_date).toISOString().split('T')[0] : null;
        vm.form.prod_rel_dt = signoff.prod_rel_dt ? new Date(signoff.prod_rel_dt).toISOString().split('T')[0] : null;
        vm.form.cm_number = signoff.cm_number;
        vm.form.JIRA_Link = signoff.jira_link;
        vm.form.project_details = signoff.project_details;
        vm.form.observations = signoff.observations;
        vm.form.caveats = signoff.caveats;
        vm.form.outofscope = signoff.outOfScope || signoff.outofscope;
        vm.form.defect_filter_link = signoff.defect_filter_link;
        vm.form.evidences = signoff.evidences;
        vm.form.comments = signoff.comments;
        vm.form.tasktype = signoff.tasktype;
        vm.form.signofftype = signoff.SignOffType || signoff.signofftype;
        vm.form.rag_status = signoff.rag_status;
      }

      // Map test cases data
      if (data.testcases && data.testcases.length > 0) {
        vm.form.testCases = {
          passed: { riast: 0, riasp: 0 },
          failed: { riast: 0, riasp: 0 },
          unexecuted: { riast: 0, riasp: 0 }
        };

        data.testcases.forEach(function(tc) {
          if (tc.test_type === 'RIAST') {
            vm.form.testCases.passed.riast = tc.passed || 0;
            vm.form.testCases.failed.riast = tc.failed || 0;
            vm.form.testCases.unexecuted.riast = tc['non-executed'] || 0;
          } else if (tc.test_type === 'RIASP') {
            vm.form.testCases.passed.riasp = tc.passed || 0;
            vm.form.testCases.failed.riasp = tc.failed || 0;
            vm.form.testCases.unexecuted.riasp = tc['non-executed'] || 0;
          }
        });
      }

      // Map defects data
      if (data.defects && data.defects.length > 0) {
        vm.form.defects = {
          enhancements: { resolved: 0, deferred: 0 },
          defects: { resolved: 0, deferred: 0 }
        };

        data.defects.forEach(function(def) {
          if (def.defect_type === 'Enhancements') {
            vm.form.defects.enhancements.resolved = def.resolved || 0;
            vm.form.defects.enhancements.deferred = def.deffered || 0;
          } else if (def.defect_type === 'Defects') {
            vm.form.defects.defects.resolved = def.resolved || 0;
            vm.form.defects.defects.deferred = def.deffered || 0;
          }
        });
      }

      vm.loading = false;
    }).catch(function(err) {
      vm.loading = false;
      console.error('Error loading sign-off data:', err);
      alert('Error loading sign-off data: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.save = function() {
    vm.loading = true;
    var data = angular.copy(vm.form);
    data.user_id = vm.currentUser.userid;
    data.status = 'In progress';
    
    // Ensure date fields are properly formatted or null
    data.start_date = vm.formatDateForSending(vm.form.start_date);
    data.end_date = vm.formatDateForSending(vm.form.end_date);
    data.actual_start_date = vm.formatDateForSending(vm.form.actual_start_date);
    data.actual_end_date = vm.formatDateForSending(vm.form.actual_end_date);
    data.prod_rel_dt = vm.formatDateForSending(vm.form.prod_rel_dt);
    
    console.log('Saving data with dates:', {
      start_date: data.start_date,
      end_date: data.end_date,
      actual_start_date: data.actual_start_date,
      actual_end_date: data.actual_end_date,
      prod_rel_dt: data.prod_rel_dt
    });
    
    var apiCall = vm.isEditMode ? 
      ApiService.updateSignOff(vm.signOffId, data) : 
      ApiService.createSignOff(data);
    
    apiCall.then(function(response) {
      vm.loading = false;
      // Use the message from the backend response if available, otherwise use default
      var message = response.data && response.data.message ? 
        response.data.message : 
        (vm.isEditMode ? 'Sign off updated successfully!' : 'Sign off saved successfully!');
      alert(message);
      $state.go('dashboard');
    }).catch(function(err) {
      vm.loading = false;
      console.error('Error saving sign off:', err);
      alert('Error saving sign off: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.submit = function() {
    if (!vm.form.project_name || !vm.form.VDS_id) {
      alert('Please fill required fields');
      return;
    }
    
    vm.loading = true;
    var data = angular.copy(vm.form);
    data.user_id = vm.currentUser.userid;
    data.status = 'Complete';
    
    // Ensure date fields are properly formatted or null
    data.start_date = vm.formatDateForSending(vm.form.start_date);
    data.end_date = vm.formatDateForSending(vm.form.end_date);
    data.actual_start_date = vm.formatDateForSending(vm.form.actual_start_date);
    data.actual_end_date = vm.formatDateForSending(vm.form.actual_end_date);
    data.prod_rel_dt = vm.formatDateForSending(vm.form.prod_rel_dt);
    
    console.log('Submitting data with dates:', {
      start_date: data.start_date,
      end_date: data.end_date,
      actual_start_date: data.actual_start_date,
      actual_end_date: data.actual_end_date,
      prod_rel_dt: data.prod_rel_dt
    });
    
    var apiCall = vm.isEditMode ? 
      ApiService.updateSignOff(vm.signOffId, data) : 
      ApiService.createSignOff(data);
    
    apiCall.then(function(response) {
      vm.loading = false;
      // Use the message from the backend response if available, otherwise use default
      var message = response.data && response.data.message ? 
        response.data.message : 
        (vm.isEditMode ? 'Sign off updated and submitted successfully!' : 'Sign off submitted successfully! Email notification sent.');
      alert(message);
      $state.go('dashboard');
    }).catch(function(err) {
      vm.loading = false;
      console.error('Error submitting sign off:', err);
      alert('Error submitting sign off: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.goHome = function() {
    $state.go('dashboard');
  };

  // Calculate Test Cases Total
  vm.calculateTestCaseTotal = function(column) {
    var total = 0;
    if (vm.form.testCases) {
      total += parseInt(vm.form.testCases.passed[column] || 0);
      total += parseInt(vm.form.testCases.failed[column] || 0);
      total += parseInt(vm.form.testCases.unexecuted[column] || 0);
    }
    return total;
  };

  // Calculate Defects Total
  vm.calculateDefectsTotal = function(column) {
    var total = 0;
    if (vm.form.defects) {
      total += parseInt(vm.form.defects.enhancements[column] || 0);
      total += parseInt(vm.form.defects.defects[column] || 0);
    }
    return total;
  };

  // RAG Status Styling
  vm.getRagStatusStyle = function() {
    switch(vm.form.rag_status) {
      case 'RED':
        return { 'background-color': '#ffebee', 'color': '#c62828' };
      case 'AMBER':
        return { 'background-color': '#fff8e1', 'color': '#f57c00' };
      case 'GREEN':
        return { 'background-color': '#e8f5e8', 'color': '#2e7d32' };
      default:
        return {};
    }
  };

  // Check if user is logged in
  if (!localStorage.getItem('qa_token')) {
    $state.go('login');
    return;
  }

  // Toggle old records view
  vm.toggleOldRecords = function() {
    vm.showOldRecords = !vm.showOldRecords;
    if (vm.showOldRecords && vm.oldRecords.length === 0) {
      vm.loadOldRecords();
    }
  };

  vm.init();
}]);

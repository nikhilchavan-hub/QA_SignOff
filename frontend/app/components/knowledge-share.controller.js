// Knowledge Share Controller
angular.module('qaSignOffApp')
.controller('KnowledgeShareController', ['$state', '$sce', 'ApiService', function($state, $sce, ApiService) {
  var vm = this;
  vm.knowledgeItems = [];
  vm.filteredItems = [];
  vm.paginatedItems = [];
  vm.loading = false;
  vm.submitting = false;
  vm.selectedFile = null;
  vm.showModal = false;
  vm.searchTerm = '';
  vm.currentUser = JSON.parse(localStorage.getItem('qa_user') || '{}');
  
  // Pagination properties
  vm.currentPage = 1;
  vm.itemsPerPage = 10;
  vm.totalPages = 1;
  
  vm.newTopic = {
    subject: '',
    description: ''
  };

  vm.getDescriptionLength = function() {
    return vm.newTopic.description ? vm.newTopic.description.length : 0;
  };

  // Enhanced search functionality - filters by Title and Author only
  vm.searchItems = function() {
    if (!vm.searchTerm || vm.searchTerm.trim() === '') {
      vm.filteredItems = vm.knowledgeItems;
    } else {
      var searchTerm = vm.searchTerm.toLowerCase().trim();
      vm.filteredItems = vm.knowledgeItems.filter(function(item) {
        // Search in Title (subject) - case-insensitive partial match
        var titleMatch = item.subject && item.subject.toLowerCase().includes(searchTerm);
        
        // Search in Author (author_name) - case-insensitive partial match
        var authorMatch = item.author_name && item.author_name.toLowerCase().includes(searchTerm);
        
        return titleMatch || authorMatch;
      });
    }
    vm.currentPage = 1;
    vm.updatePagination();
  };

  // Pagination functions
  vm.updatePagination = function() {
    vm.totalPages = vm.filteredItems.length > 0 ? Math.ceil(vm.filteredItems.length / vm.itemsPerPage) : 1;
    if (vm.currentPage > vm.totalPages || vm.currentPage < 1) {
      vm.currentPage = Math.max(1, Math.min(vm.totalPages, vm.currentPage));
    }
    vm.updatePaginatedItems();
  };

  vm.updatePaginatedItems = function() {
    var startIndex = (vm.currentPage - 1) * vm.itemsPerPage;
    var endIndex = startIndex + vm.itemsPerPage;
    vm.paginatedItems = vm.filteredItems.slice(startIndex, endIndex);
    console.log('Knowledge Share pagination updated:', {
      currentPage: vm.currentPage,
      totalPages: vm.totalPages,
      totalFiltered: vm.filteredItems.length,
      paginatedItems: vm.paginatedItems.length,
      startIndex: startIndex,
      endIndex: endIndex
    });
  };

  vm.goToPage = function(page) {
    if (page >= 1 && page <= vm.totalPages && page !== vm.currentPage) {
      vm.currentPage = page;
      vm.updatePaginatedItems();
    }
  };

  vm.previousPage = function() {
    if (vm.currentPage > 1) {
      vm.currentPage--;
      vm.updatePaginatedItems();
    }
  };

  vm.nextPage = function() {
    if (vm.currentPage < vm.totalPages) {
      vm.currentPage++;
      vm.updatePaginatedItems();
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

  vm.clearSearch = function() {
    vm.searchTerm = '';
    vm.currentPage = 1;
    vm.searchItems();
  };

  // Highlight search terms in text
  vm.highlightSearch = function(text, searchTerm) {
    if (!searchTerm || !text) return $sce.trustAsHtml(text);
    
    var regex = new RegExp('(' + searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    var highlightedText = text.replace(regex, '<mark style="background-color: #ffeb3b; padding: 1px 2px;">$1</mark>');
    return $sce.trustAsHtml(highlightedText);
  };

  vm.init = function() {
    vm.loadKnowledgeItems();
  };

  vm.loadKnowledgeItems = function() {
    vm.loading = true;
    ApiService.getKnowledgeShare().then(function(response) {
      vm.knowledgeItems = response.data;
      vm.filteredItems = vm.knowledgeItems; // Initialize filtered items
      vm.currentPage = 1;
      vm.updatePagination();
      vm.loading = false;
    }).catch(function(err) {
      vm.loading = false;
      console.error('Error loading knowledge share items:', err);
      if (err.status === 401) {
        $state.go('login');
      }
    });
  };

  vm.openAddTopicModal = function() {
    vm.newTopic = {
      subject: '',
      description: ''
    };
    vm.selectedFile = null;
    vm.showModal = true;
    
    // Use jQuery if available, otherwise use timeout for DOM update
    setTimeout(function() {
      if (typeof $ !== 'undefined') {
        $('#addTopicModal').modal('show');
      }
    }, 100);
  };

  vm.closeModal = function() {
    vm.showModal = false;
    if (typeof $ !== 'undefined') {
      $('#addTopicModal').modal('hide');
    }
  };

  vm.handleFileSelect = function(input) {
    if (input.files && input.files[0]) {
      vm.selectedFile = input.files[0];
      
      // Validate file type
      var allowedTypes = [
        'application/zip',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/x-ms-wmv',
        'video/x-flv',
        'video/webm',
        'video/3gpp'
      ];
      
      var fileExtension = vm.selectedFile.name.split('.').pop().toLowerCase();
      var allowedExtensions = ['zip', 'pdf', 'docx', 'csv', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', '3gp'];
      
      if (!allowedExtensions.includes(fileExtension)) {
        alert('Invalid file type. Please select a valid file format.');
        input.value = '';
        vm.selectedFile = null;
        return;
      }
      
      // Check file size (limit to 50MB)
      if (vm.selectedFile.size > 50 * 1024 * 1024) {
        alert('File size too large. Please select a file smaller than 50MB.');
        input.value = '';
        vm.selectedFile = null;
        return;
      }
    }
  };

  vm.submitTopic = function() {
    if (!vm.newTopic.subject || !vm.newTopic.description) {
      alert('Please fill in all required fields');
      return;
    }

    if (vm.newTopic.description.length > 1000) {
      alert('Description cannot exceed 1000 characters');
      return;
    }

    vm.submitting = true;
    
    var formData = new FormData();
    formData.append('subject', vm.newTopic.subject);
    formData.append('description', vm.newTopic.description);
    formData.append('user_id', vm.currentUser.userid);
    
    if (vm.selectedFile) {
      formData.append('document', vm.selectedFile);
    }

    ApiService.createKnowledgeShare(formData).then(function(response) {
      vm.submitting = false;
      vm.closeModal();
      alert('Topic added successfully!');
      vm.loadKnowledgeItems(); // This will refresh both knowledgeItems and filteredItems
    }).catch(function(err) {
      vm.submitting = false;
      alert('Error adding topic: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.downloadFile = function(item) {
    if (!item.uploadeddocument) {
      alert('No file available for download');
      return;
    }
    
    ApiService.downloadKnowledgeFile(item.id).then(function(response) {
      // Create blob and download
      var blob = new Blob([response.data], { type: response.headers('content-type') });
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = item.uploadeddocument;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }).catch(function(err) {
      alert('Error downloading file: ' + (err.data && err.data.error || 'Unknown error'));
    });
  };

  vm.formatDate = function(dateString) {
    if (!dateString) return '';
    var date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  vm.formatFileSize = function(bytes) {
    if (!bytes) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  vm.goBack = function() {
    $state.go('dashboard');
  };

  // Tooltip positioning functions
  vm.showTooltip = function(event, description) {
    var target = event.currentTarget || event.target;
    var tooltip = target.querySelector('.tooltip-text');
    if (!tooltip) return;
    
    // Set the tooltip content
    tooltip.textContent = description;
    
    // Make tooltip visible to measure its dimensions
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '0';
    
    // Use setTimeout to ensure DOM is updated
    setTimeout(function() {
      var rect = target.getBoundingClientRect();
      var tooltipRect = tooltip.getBoundingClientRect();
      var windowWidth = window.innerWidth;
      var windowHeight = window.innerHeight;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Default position: below the element
      var top = rect.bottom + scrollTop + 10;
      var left = rect.left + scrollLeft;
      var position = 'tooltip-bottom';
      
      // Check if tooltip would be clipped at the bottom
      if (top + tooltipRect.height > windowHeight + scrollTop) {
        // Position above the element
        top = rect.top + scrollTop - tooltipRect.height - 10;
        position = 'tooltip-top';
      }
      
      // Check if tooltip would be clipped at the top
      if (top < scrollTop) {
        // Position to the right of the element
        top = rect.top + scrollTop + (rect.height - tooltipRect.height) / 2;
        left = rect.right + scrollLeft + 10;
        position = 'tooltip-right';
      }
      
      // Check if tooltip would be clipped at the right
      if (left + tooltipRect.width > windowWidth + scrollLeft) {
        // Position to the left of the element
        left = rect.left + scrollLeft - tooltipRect.width - 10;
        position = 'tooltip-left';
      }
      
      // Check if tooltip would be clipped at the left
      if (left < scrollLeft) {
        // Fallback: center it horizontally and position below with margin
        left = Math.max(scrollLeft + 10, rect.left + scrollLeft - (tooltipRect.width - rect.width) / 2);
        top = rect.bottom + scrollTop + 10;
        position = 'tooltip-bottom';
        
        // Ensure it doesn't go beyond the right edge
        if (left + tooltipRect.width > windowWidth + scrollLeft) {
          left = windowWidth + scrollLeft - tooltipRect.width - 10;
        }
      }
      
      // Apply positioning
      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
      
      // Remove all position classes and add the appropriate one
      tooltip.className = tooltip.className.replace(/tooltip-(top|bottom|left|right)/g, '');
      tooltip.classList.add(position);
      
      // Show tooltip with animation
      setTimeout(function() {
        tooltip.style.opacity = '1';
      }, 10);
    }, 10);
  };

  vm.hideTooltip = function(event) {
    var target = event.currentTarget || event.target;
    var tooltip = target.querySelector('.tooltip-text');
    if (tooltip) {
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    }
  };

  // Check if user is logged in
  if (!localStorage.getItem('qa_token')) {
    $state.go('login');
    return;
  }

  // Initialize
  vm.init();
}]);

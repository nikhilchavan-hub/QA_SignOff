// AngularJS Routing Configuration
angular.module('qaSignOffApp')
.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/login');
    
    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'app/components/signup-login.component.html',
            controller: 'AuthController',
            controllerAs: 'vm'
        })
        .state('dashboard', {
            url: '/dashboard',
            templateUrl: 'app/components/dashboard.component.html',
            controller: 'DashboardController',
            controllerAs: 'vm'
        })
        .state('signoff-new', {
            url: '/signoff/new',
            templateUrl: 'app/components/new-signoff-form.component.html',
            controller: 'SignOffController',
            controllerAs: 'vm'
        })
        .state('signoff-edit', {
            url: '/signoff/edit/:id',
            templateUrl: 'app/components/new-signoff-form.component.html',
            controller: 'SignOffController',
            controllerAs: 'vm'
        })
        .state('signoff-view', {
            url: '/signoff/view/:id',
            templateUrl: 'app/components/signoff-view.component.html',
            controller: 'SignOffViewController',
            controllerAs: 'vm'
        })
        .state('knowledge-share', {
            url: '/knowledge-share',
            templateUrl: 'app/components/knowledge-share.component.html',
            controller: 'KnowledgeShareController',
            controllerAs: 'vm'
        });
}]);

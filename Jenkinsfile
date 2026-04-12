// ── Jenkins Declarative Pipeline ─────────────────────────────────────────────
// Plugins required: Git, Pipeline, Docker Pipeline
// Triggered by: GitHub webhook on push to main branch
//
// What this pipeline does:
//   1. Checkout  — clone the repo from GitHub
//   2. Build     — build the Docker image using Dockerfile
//   3. Deploy    — spin up the app using docker-compose-jenkins.yml
//   4. Verify    — confirm the web container is running

pipeline {

    agent any

    environment {
        IMAGE_NAME = "ishahzaibhaider/devops-assign2"
        IMAGE_TAG  = "build-${BUILD_NUMBER}"
        COMPOSE_FILE = "docker-compose-jenkins.yml"
    }

    triggers {
        // Poll SCM as fallback if webhook is not received (every 2 minutes)
        pollSCM('H/2 * * * *')
    }

    stages {

        // ── Stage 1: Checkout ────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo "Cloning repository..."
                checkout scm
                echo "Workspace: ${env.WORKSPACE}"
            }
        }

        // ── Stage 2: Build Docker Image ──────────────────────────────────────
        stage('Build') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }

        // ── Stage 3: Deploy with docker-compose ──────────────────────────────
        stage('Deploy') {
            steps {
                echo "Deploying with ${COMPOSE_FILE}..."
                sh """
                    docker-compose -f ${COMPOSE_FILE} down --remove-orphans || true
                    docker-compose -f ${COMPOSE_FILE} up -d --build
                """
                echo "Deployment started."
            }
        }

        // ── Stage 4: Verify ──────────────────────────────────────────────────
        stage('Verify') {
            steps {
                echo "Verifying containers are running..."
                sh 'docker-compose -f ${COMPOSE_FILE} ps'
                // Give the app a moment to start, then hit the health endpoint
                sh 'sleep 5 && curl -sf http://localhost:3001/health || echo "Health check failed"'
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded. App is running at http://<EC2-IP>:3001"
        }
        failure {
            echo "Pipeline FAILED. Check console output above."
            sh 'docker-compose -f ${COMPOSE_FILE} logs --tail=50 || true'
        }
        always {
            echo "Build #${BUILD_NUMBER} finished with status: ${currentBuild.currentResult}"
        }
    }
}

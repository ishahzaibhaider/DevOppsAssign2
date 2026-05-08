// ── Jenkins Declarative Pipeline ─────────────────────────────────────────────
// Plugins required: Git, Pipeline, Docker Pipeline, Email Extension (email-ext),
// JUnit
// Triggered by: GitHub webhook on push to main branch
//
// What this pipeline does:
//   1. Checkout — clone the repo from GitHub
//   2. Build    — build the Docker image
//   3. Deploy   — bring the app up via docker-compose-jenkins.yml
//   4. Verify   — confirm the web container is healthy
//   5. Test     — clone Selenium test repo, run pytest in a Dockerised
//                 selenium/standalone-chrome + python:3.11-slim setup
//   6. Email    — post step emails JUnit results to whoever pushed

pipeline {

    agent any

    environment {
        IMAGE_NAME       = "ishahzaibhaider/devops-assign2"
        IMAGE_TAG        = "build-${BUILD_NUMBER}"
        COMPOSE_FILE     = "docker-compose-jenkins.yml"

        // Test wiring
        TESTS_REPO       = "https://github.com/ishahzaibhaider/student-records-tests.git"
        TESTS_DIR        = "tests-repo"
        APP_CONTAINER    = "student_records_web_ci"
        APP_INTERNAL_URL = "http://student_records_web_ci:3000"
        SELENIUM_NAME    = "selenium-chrome-${BUILD_NUMBER}"
        SELENIUM_URL     = "http://${SELENIUM_NAME}:4444/wd/hub"
    }

    triggers {
        // Poll SCM as a fallback if the GitHub webhook is missed (every 2 min)
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
                sh '''
                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        if curl -sf http://localhost:3001/health >/dev/null; then
                            echo "Health check passed"
                            exit 0
                        fi
                        echo "Waiting for app to be ready... ($i/10)"
                        sleep 3
                    done
                    echo "Health check FAILED after 30s"
                    exit 1
                '''
            }
        }

        // ── Stage 5: Selenium Tests (Dockerised) ─────────────────────────────
        stage('Test') {
            steps {
                script {
                    echo "Cloning test repository..."
                    sh """
                        rm -rf ${TESTS_DIR}
                        git clone --depth 1 ${TESTS_REPO} ${TESTS_DIR}
                    """

                    echo "Discovering app's Docker network..."
                    def appNetwork = sh(
                        returnStdout: true,
                        script: "docker inspect ${APP_CONTAINER} --format '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'"
                    ).trim()
                    echo "App network: ${appNetwork}"

                    echo "Starting Selenium Chrome on the app's network..."
                    sh """
                        docker rm -f ${SELENIUM_NAME} || true
                        docker run -d --name ${SELENIUM_NAME} \\
                            --network ${appNetwork} \\
                            --shm-size=2g \\
                            selenium/standalone-chrome:latest

                        echo "Waiting for Selenium to be ready..."
                        for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
                            if docker exec ${SELENIUM_NAME} curl -sf http://localhost:4444/wd/hub/status >/dev/null 2>&1; then
                                echo "Selenium is ready"
                                break
                            fi
                            sleep 2
                        done
                    """

                    echo "Running pytest..."
                    sh """
                        docker run --rm \\
                            --network ${appNetwork} \\
                            -v "\$(pwd)/${TESTS_DIR}:/tests" -w /tests \\
                            -e APP_URL=${APP_INTERNAL_URL} \\
                            -e SELENIUM_URL=${SELENIUM_URL} \\
                            python:3.11-slim sh -c "
                                pip install --quiet --no-cache-dir -r requirements.txt &&
                                pytest --junitxml=results.xml --tb=short
                            "
                    """
                }
            }
            post {
                always {
                    sh "docker rm -f ${SELENIUM_NAME} || true"
                    junit allowEmptyResults: true, testResults: "${TESTS_DIR}/results.xml"
                    archiveArtifacts artifacts: "${TESTS_DIR}/results.xml", allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            script {
                // Resolve the email of whoever made the latest commit (the pusher).
                // env.CHANGE_AUTHOR_EMAIL is only set on multibranch PR builds; for
                // a plain push trigger, read it from the commit metadata.
                def pusherEmail = sh(
                    returnStdout: true,
                    script: "git log -1 --pretty=format:'%ae' || true"
                ).trim()

                if (!pusherEmail || pusherEmail == "") {
                    echo "Could not resolve pusher email; skipping notification."
                } else {
                    echo "Sending build report to: ${pusherEmail}"

                    def status      = currentBuild.currentResult
                    def commitSha   = sh(returnStdout: true, script: "git rev-parse --short HEAD || true").trim()
                    def commitMsg   = sh(returnStdout: true, script: "git log -1 --pretty=format:'%s' || true").trim()

                    def testSummary = "<p><i>(no JUnit report available — Test stage may not have run)</i></p>"
                    def resultsXml  = "${env.TESTS_DIR}/results.xml"
                    if (fileExists(resultsXml)) {
                        try {
                            def line = sh(returnStdout: true, script: """
                                python3 - <<'PY' 2>/dev/null
import xml.etree.ElementTree as ET
root = ET.parse('${resultsXml}').getroot()
node = root if 'tests' in root.attrib else next(iter(root))
a = node.attrib
print(f"total={a.get('tests','0')} failures={a.get('failures','0')} errors={a.get('errors','0')} skipped={a.get('skipped','0')}")
PY
                            """).trim()
                            testSummary = line ? "<p><b>Tests:</b> ${line}</p>" : "<p><i>(results.xml present but unreadable — see attachment)</i></p>"
                        } catch (ignored) {
                            testSummary = "<p><i>(results.xml present — see attachment for details)</i></p>"
                        }
                    }

                    emailext(
                        subject: "[Jenkins] ${env.JOB_NAME} #${env.BUILD_NUMBER} — ${status}",
                        to: pusherEmail,
                        mimeType: 'text/html',
                        body: """
                            <h3>Build #${env.BUILD_NUMBER} — ${status}</h3>
                            <p><b>Project:</b> ${env.JOB_NAME}</p>
                            <p><b>Commit:</b> ${commitSha} — ${commitMsg}</p>
                            <p><b>Pusher:</b> ${pusherEmail}</p>
                            ${testSummary}
                            <p>
                              <a href="${env.BUILD_URL}console">Console output</a> &nbsp;|&nbsp;
                              <a href="${env.BUILD_URL}testReport/">Test report</a> &nbsp;|&nbsp;
                              <a href="${env.BUILD_URL}artifact/${env.TESTS_DIR}/results.xml">results.xml</a>
                            </p>
                        """,
                        attachmentsPattern: "${env.TESTS_DIR}/results.xml"
                    )
                }
            }

            echo "Build #${BUILD_NUMBER} finished with status: ${currentBuild.currentResult}"
        }
        failure {
            sh 'docker-compose -f ${COMPOSE_FILE} logs --tail=50 || true'
        }
    }
}

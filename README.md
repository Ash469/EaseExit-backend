# College Leave Management Backend 🎓

A comprehensive backend system for managing college student leave applications, built to streamline the leave approval process and enhance administrative efficiency in educational institutions.

## 🌟 Overview

The College Leave Management Backend is a robust server-side application designed to digitize and automate the traditional paper-based leave application process in colleges and universities. It provides a centralized platform for students to submit leave requests, faculty to review applications, and administrators to manage the entire leave ecosystem.

## ✨ Key Features

### 🔐 Authentication & Authorization
- **JWT-based authentication** for secure user sessions
- **Role-based access control** (Student, Faculty, HOD, Dean, Administrator)
- **Multi-factor authentication** support
- **Password reset** functionality with email verification
- **Session management** with automatic expiration

### 📝 Leave Management
- **Multi-type leave applications** (Medical, Emergency, Personal, Academic)
- **Real-time leave status tracking** (Pending, Approved, Rejected, Expired)
- **Leave balance management** with automatic calculations
- **Leave history** and analytics for students and administrators
- **Bulk leave operations** for administrative efficiency
- **Leave policy enforcement** with customizable rules

### 🔄 Approval Workflow
- **Multi-tier approval process** (Faculty → HOD → Dean → VC)
- **Automated routing** based on leave type and duration
- **Approval delegation** for absent approvers
- **Override capabilities** for emergency situations
- **Audit trail** for all approval activities

### 📧 Communication System
- **Automated email notifications** for status updates
- **Real-time push notifications** via WebSocket
- **SMS integration** for critical updates
- **Customizable notification templates**
- **Escalation alerts** for pending applications

### 📊 Analytics & Reporting
- **Leave analytics dashboard** with interactive charts
- **Department-wise leave statistics**
- **Peak leave period analysis**
- **Leave pattern insights**
- **Export functionality** (PDF, Excel, CSV)

## 🛠️ Technical Stack

### Core Technologies
- **Runtime**: Node.js 18.x
- **Framework**: Express.js 4.x
- **Database**: MongoDB 6.x with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi for request validation
- **File Upload**: Multer for document handling
- **Email Service**: Nodemailer with SMTP/OAuth2

### Development Tools
- **Language**: TypeScript for type safety
- **Testing**: Jest & Supertest for comprehensive testing
- **Documentation**: Swagger/OpenAPI 3.0
- **Code Quality**: ESLint, Prettier, Husky
- **Process Management**: PM2 for production deployment

### External Services
- **Cloud Storage**: AWS S3 for document storage
- **Email Service**: SendGrid/AWS SES for notifications
- **SMS Service**: Twilio for SMS notifications
- **Monitoring**: Winston for logging, New Relic for APM

## 🏗️ Architecture

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Backend       │
│   (React/Vue)   │◄──►│   (Express.js)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Rate Limiter  │    │   Database      │
                       │   & Security    │    │   (MongoDB)     │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   External      │    │   File Storage  │
                       │   Services      │    │   (AWS S3)      │
                       └─────────────────┘    └─────────────────┘
```

### Database Schema
```javascript
// Core Collections
├── users                 // Student/Faculty profiles
├── leave_requests        // Leave applications
├── leave_types          // Leave categories & policies
├── leave_balances       // User leave entitlements
├── approval_workflows   // Approval process definitions
├── notifications        // System notifications
├── audit_logs          // System activity logs
└── configurations      // System settings
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- MongoDB 6.x or higher
- NPM or Yarn package manager
- Redis (for session management)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/laladwesh/college-leave-backend.git
   cd college-leave-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB service
   npm run db:seed        # Optional: Seed with sample data
   npm run db:migrate     # Run database migrations
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

## ⚙️ Configuration

### Environment Variables
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/college-leave-db
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=24h
JWT_REFRESH_SECRET=your-refresh-secret

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AWS Configuration (Optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Notification Services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number
```

## 📚 API Documentation

### Authentication Endpoints
```javascript
POST   /api/auth/login           // User login
POST   /api/auth/register        // Student registration
POST   /api/auth/refresh         // Refresh JWT token
POST   /api/auth/logout          // User logout
POST   /api/auth/forgot-password // Password reset request
POST   /api/auth/reset-password  // Password reset confirmation
```

### Leave Management Endpoints
```javascript
// Leave Requests
GET    /api/leaves               // Get all leave requests
GET    /api/leaves/:id           // Get specific leave request
POST   /api/leaves               // Create new leave request
PUT    /api/leaves/:id           // Update leave request
DELETE /api/leaves/:id           // Delete leave request

// Leave Actions
POST   /api/leaves/:id/approve   // Approve leave request
POST   /api/leaves/:id/reject    // Reject leave request
POST   /api/leaves/:id/cancel    // Cancel leave request

// Leave Analytics
GET    /api/leaves/analytics     // Get leave statistics
GET    /api/leaves/history       // Get leave history
GET    /api/leaves/balance       // Get leave balance
```

### User Management Endpoints
```javascript
GET    /api/users                // Get all users (Admin only)
GET    /api/users/:id            // Get user profile
PUT    /api/users/:id            // Update user profile
DELETE /api/users/:id            // Delete user (Admin only)
GET    /api/users/roles          // Get user roles
```

### Administrative Endpoints
```javascript
GET    /api/admin/dashboard      // Admin dashboard data
GET    /api/admin/reports        // Generate reports
POST   /api/admin/policies       // Create leave policies
PUT    /api/admin/policies/:id   // Update leave policies
GET    /api/admin/audit-logs     // Get audit logs
```

## 🔧 Usage Examples

### Creating a Leave Request
```javascript
// POST /api/leaves
{
  "leaveType": "medical",
  "startDate": "2024-07-10",
  "endDate": "2024-07-15",
  "reason": "Medical treatment required",
  "documents": ["medical-certificate.pdf"],
  "emergencyContact": "+1234567890"
}
```

### Approving a Leave Request
```javascript
// POST /api/leaves/:id/approve
{
  "approverComments": "Approved for medical reasons",
  "approverLevel": "hod",
  "alternateArrangements": "Classes will be covered by substitute faculty"
}
```

### Getting Leave Statistics
```javascript
// GET /api/leaves/analytics?department=CSE&month=2024-07
{
  "totalRequests": 45,
  "approvedRequests": 38,
  "rejectedRequests": 5,
  "pendingRequests": 2,
  "averageProcessingTime": "2.5 days",
  "mostCommonLeaveType": "medical"
}
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Test Structure
```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── fixtures/         # Test data
└── helpers/          # Test utilities
```

## 📈 Performance & Monitoring

### Performance Optimizations
- **Database indexing** for frequently queried fields
- **Caching layer** with Redis for improved response times
- **Request rate limiting** to prevent API abuse
- **Pagination** for large dataset queries
- **Compression** for reduced payload sizes

### Monitoring Features
- **Health check endpoints** for system monitoring
- **Performance metrics** collection
- **Error tracking** and alerting
- **Request logging** with correlation IDs
- **Real-time dashboards** for system health

## 🔒 Security Features

### Data Protection
- **Input validation** and sanitization
- **SQL injection prevention** via parameterized queries
- **XSS protection** with proper encoding
- **CSRF protection** for state-changing operations
- **Rate limiting** to prevent brute force attacks

### Authentication Security
- **Password hashing** with bcrypt
- **JWT token encryption** and expiration
- **Secure session management**
- **Account lockout** after failed attempts
- **Audit logging** for security events

## 🚀 Deployment

### Production Deployment
```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Or with Docker
docker build -t college-leave-backend .
docker run -p 5000:5000 college-leave-backend
```

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: college-leave-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: college-leave-backend
  template:
    metadata:
      labels:
        app: college-leave-backend
    spec:
      containers:
      - name: backend
        image: college-leave-backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
```

## 🤝 Contributing

We welcome contributions to improve the College Leave Management Backend! Please follow these guidelines:

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards
- Follow TypeScript best practices
- Maintain test coverage above 90%
- Use meaningful commit messages
- Update documentation for API changes
- Follow the existing code style

### Issues and Bug Reports
- Use the issue template provided
- Include steps to reproduce
- Provide environment details
- Add relevant labels

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Contributors**: Thanks to all the developers who have contributed to this project
- **Educational Institutions**: For providing requirements and feedback
- **Open Source Community**: For the amazing tools and libraries used
- **Beta Testers**: For helping identify issues and improve the system

## 📞 Support

### Getting Help
- **Documentation**: Check the [Wiki](https://github.com/laladwesh/college-leave-backend/wiki)
- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/laladwesh/college-leave-backend/issues)
- **Discussions**: Join the [GitHub Discussions](https://github.com/laladwesh/college-leave-backend/discussions)
- **Email**: Contact the maintainers at [support@college-leave.com](mailto:support@college-leave.com)

### Professional Support
For enterprise support, custom development, or consulting services, please contact our professional services team.

---

<div align="center">
  <p>Built with ❤️ for educational institutions worldwide</p>
  <p>
    <a href="https://github.com/laladwesh/college-leave-backend/stargazers">⭐ Star this repo</a> |
    <a href="https://github.com/laladwesh/college-leave-backend/issues">🐛 Report Bug</a> |
    <a href="https://github.com/laladwesh/college-leave-backend/issues">✨ Request Feature</a>
  </p>
</div>

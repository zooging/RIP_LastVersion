const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const session = require("express-session");

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sequelize = new Sequelize("lab1", "root", "maniken385sao", {
  dialect: "mysql",
  //host: "localhost",
  host: "mysql",
  define: {
    timestamps: false,
  },


});

const User = sequelize.define('user', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
}, { timestamps: false }); 


app.use(session({
  secret: "zooza", 
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ where: { email: email } });

      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
    exposedHeaders: ["my-custom-header"],
  },
});

const Task = sequelize.define("task", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  isDone: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    allowNull: false,
  },
});


io.on("connection", (socket) => {
  console.log("Новое подключение к чату");

  socket.on("chat message", (msg) => {
    console.log("Сообщение от клиента:", msg);
    io.emit("chat message", msg);
  });

  socket.on("clear chat", () => {
    io.emit("clear chat");
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  socket.on("close", (reasonCode, description) => {
    console.log("Connection closed:", reasonCode, description);
  });
});

app.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({ where: { email: email } });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email: email,
      password: hashedPassword,
    });

    // Возвращает данные о пользователе и токен для авторизации
    res.json({ user: newUser, token: 'your_generated_token' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Аутентификация пользователя
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication failed.' });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }

      return res.json({ user: req.user, token: 'your_generated_token' });
    });
  })(req, res, next);
});

app.get("/", function (request, response) {
  Task.findAll({ raw: true }).then((tasks) => {
    response.send(tasks);
  });
});

app.post("/", function (request, response) {
  Task.create({
    title: request.body.title,
    isDone: "Not Done",
  });
  Task.findAll({ raw: true }).then((tasks) => {
    response.json(tasks);
  });
});

app.put("/", function (request, response) {
  const id = request.body.id;
  const updatedTitle = request.body.title;
  const updatedIsDone = request.body.isDone;

  Task.findByPk(id)
    .then((task) => {
      if (!task) {
        return response.status(404).json({ error: "Запись не найдена" });
      }

      return task.update({
        title: updatedTitle || task.title,
        isDone: updatedIsDone || task.isDone,
      });
    })
    .then((updatedTask) => {
      response.json(updatedTask);
    })
    .catch((error) => {
      response.status(500).json({ error: "Ошибка сервера" });
    });
});

app.delete("/", function (request, response) {
  const id = request.query.id;
  Task.destroy({
    where: {
      id: id,
    },
  }).then(() => {
    response.send("Успешно удалено");
  });
});

sequelize.sync({ force: false }).then(() => {
  // Дополнительные действия после синхронизации
  console.log("База данных успешно синхронизирована");

  // Запуск сервера
  server.listen(3000, () => {
    console.log("Сервер запущен на порту 3000");
  });
});

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log('1. Посмотреть все задачи');
  console.log('2. Создать новую задачу');
  console.log('3. Редактировать задачу');
  console.log('4. Удалить задачу');
  console.log('5. Посмотреть всех пользователей');
  console.log('6. Удалить пользователя');
  console.log('7. Удалить всех пользователей');
  console.log('8. Выйти');
}


function viewAllTasks() {
  Task.findAll({ raw: true }).then(tasks => {
    console.log(tasks);
    startApp();
  });
}

function createNewTask() {
  rl.question('Введите заголовок новой задачи: ', (title) => {
    Task.create({
      title: title,
      isDone: 'Not Done'
    }).then(() => {
      console.log('Задача успешно создана.');
      startApp();
    });
  });
}

function editTask() {
  rl.question('Введите ID задачи для редактирования: ', (id) => {
    Task.findByPk(id)
      .then((task) => {
        if (!task) {
          console.log('Задача с таким ID не найдена.');
          startApp();
        }

        rl.question('Введите новый заголовок (или оставьте пустым для сохранения текущего): ', (updatedTitle) => {
          rl.question('Введите статус (или оставьте пустым для сохранения текущего): ', (updatedIsDone) => {
            task.update({
              title: updatedTitle || task.title,
              isDone: updatedIsDone || task.isDone,
            }).then(() => {
              console.log('Задача успешно отредактирована.');
              startApp();
            });
          });
        });
      })
      .catch(() => {
        console.log('Произошла ошибка при редактировании задачи.');
        startApp();
      });
  });
}

function deleteTask() {
  rl.question('Введите ID задачи для удаления: ', (id) => {
    Task.destroy({
      where: {
        id: id
      }
    }).then(() => {
      console.log('Задача успешно удалена.');
      startApp();
    });
  });
}

function viewAllUsers() {
  User.findAll({ raw: true }).then(users => {
    console.log(users);
    startApp();
  });
}

function deleteUser() {
  rl.question('Введите ID пользователя для удаления: ', (id) => {
    User.destroy({
      where: {
        id: id
      }
    }).then(() => {
      console.log('Пользователь успешно удален.');
      startApp();
    });
  });
}

function deleteAllUsers() {
  User.destroy({
    where: {},
    truncate: true
  }).then(() => {
    console.log('Все пользователи успешно удалены.');
    startApp();
  });
}

function startApp() {
  showMenu();
  rl.question('Выберите действие (введите соответствующую цифру): ', (choice) => {
    switch (choice) {
      case '1':
        viewAllTasks();
        break;
      case '2':
        createNewTask();
        break;
      case '3':
        editTask();
        break;
      case '4':
        deleteTask();
        break;
      case '8':
        rl.close();
        break;
      case '5':
        viewAllUsers();
        break;
      case '6':
        deleteUser();
        break;
      case '7':
        deleteAllUsers();
        break;
      default:
        console.log('Некорректный ввод. Попробуйте еще раз.');
        startApp();
    }
  });
}

startApp();

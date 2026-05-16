# ProjectName SDK error


class ProjectNameError(Exception):

    def __init__(self, code="", msg=""):
        self.code = code
        self.msg = msg
        self.sdk = "ProjectName"
        super().__init__(self.error())

    def error(self):
        return self.sdk + ": " + self.code + ": " + self.msg

    def __str__(self):
        return self.error()

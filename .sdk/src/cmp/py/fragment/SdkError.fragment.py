# ProjectName SDK error


class ProjectNameError(Exception):

    def __init__(self, code="", msg=""):
        self.code = code
        self.msg = msg
        self.sdk = "ProjectName"

        # HTTP status of the response that caused this error, or -1 when the
        # request never got one. PROMOTED to the top level: it used to be
        # reachable only at `err.result.status`, so every consumer coupled
        # itself to the internal shape of `result`.
        self.status = -1

        super().__init__(self.error())

    @property
    def not_found(self):
        return 404 == self.status

    def error(self):
        return self.sdk + ": " + self.code + ": " + self.msg

    def __str__(self):
        return self.error()
